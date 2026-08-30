import { productRepository, saleRepository } from '../../repositories';
import { requireAuth, getEffectiveOwnerId } from '../../auth/context';
import prisma from '../../prisma';
import { memoize } from '../../lib/cache';

export const dashboardResolvers = {
  Query: {
    dashboardData: async (_: any, __: any, context: any) => {
      const user = requireAuth(context);
      const ownerId = await getEffectiveOwnerId(context);

      return memoize(`${ownerId}::dashboard`, async () => {
        const products = await productRepository.getAll(ownerId);
        const productMap = new Map<string, any>(products.map((p: any) => [p.id, p]));

        const todayStart = startOfToday();
        const todayEnd = endOfToday();

        // Today's total revenue — computed in the DB (no full-table scan).
        const todaySalesTotal = await saleRepository.sumTotalInRange(ownerId, todayStart, todayEnd);

        // "Orders today" = number of POS checkouts recorded today (Order rows).
        const todayOrderCount = await prisma.order.count({
          where: { owner_id: ownerId, created_at: { gte: todayStart, lte: todayEnd } },
        });

        const lowStockCount = products.filter((p: any) => p.quantity <= p.low_stock_threshold && p.quantity > 0).length;

        const inventoryValue = products.reduce((sum: number, p: any) => {
          return sum + (p.buying_price || 0) * p.quantity;
        }, 0);

        // Last 7 days of sales — it is a bounded window, so we push a cheap
        // aggregate to the DB rather than loading all of history into memory.
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const weekSales = await saleRepository.getSummaryInRange(ownerId, sevenDaysAgo, new Date());

        const last7Days: { date: string; total: number }[] = [];
        for (let i = 6; i >= 0; i--) {
          const day = new Date();
          day.setDate(day.getDate() - i);
          const dayStart = startOfDay(day);
          const dayEnd = endOfDay(day);
          let dayTotal = 0;
          for (const s of weekSales) {
            const sd = new Date(s.created_at);
            if (sd >= dayStart && sd <= dayEnd) dayTotal += Number(s.total_price);
          }
          last7Days.push({
            date: day.toLocaleDateString('en-US', { weekday: 'short' }),
            total: dayTotal,
          });
        }

        // Top products by revenue in the last 7 days (DB groupBy).
        const grouped = await saleRepository.groupByProduct(ownerId, sevenDaysAgo);
        const topProducts = grouped
          .map((g: any) => ({
            productId: g.product_id,
            productName: productMap.get(g.product_id)?.name || 'Unknown',
            revenue: Number(g._sum?.total_price) || 0,
            quantity: Number(g._sum?.quantity) || 0,
          }))
          .filter((p) => p.revenue > 0)
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5);

        const recentTransactions = (await saleRepository.getRecent(ownerId, 5)).map((s: any) => ({
          id: s.id,
          productId: s.product_id,
          productName: s.product?.name || 'Unknown',
          quantity: s.quantity,
          totalPrice: s.total_price,
          createdAt: s.created_at?.toISOString?.() || s.created_at,
        }));

        const lowStockProducts = products
          .filter((p: any) => p.quantity <= p.low_stock_threshold && p.quantity > 0)
          .map((p: any) => ({
            productId: p.id,
            productName: p.name,
            quantity: p.quantity,
            threshold: p.low_stock_threshold,
            category: p.category || '',
          }))
          .slice(0, 5);

        return {
          stats: {
            todaySales: todaySalesTotal,
            todayOrderCount,
            lowStockCount,
            inventoryValue,
          },
          weeklySales: last7Days,
          topProducts,
          recentTransactions,
          lowStockProducts,
        };
      });
    },
  },
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function startOfToday(): Date {
  return startOfDay(new Date());
}

function endOfToday(): Date {
  return endOfDay(new Date());
}
