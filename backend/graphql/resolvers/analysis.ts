import { productRepository, saleRepository } from '../../repositories';
import { requireRole, getEffectiveOwnerId } from '../../auth/context';
import { memoize } from '../../lib/cache';

function dateRange(startDate?: string, endDate?: string): { start: Date; end: Date } {
  const start = startDate ? new Date(startDate) : new Date(0);
  const end = endDate ? new Date(endDate) : new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export const analysisResolvers = {
  Query: {
    salesAnalysis: async (_: any, { startDate, endDate }: any, context: any) => {
      const user = requireRole(context, 'owner', 'manager');
      const ownerId = await getEffectiveOwnerId(context);
      const { start, end } = dateRange(startDate, endDate);

      return memoize(`${ownerId}::analysis:sales:${start.getTime()}:${end.getTime()}`, async () => {
        // Compute aggregates in the DB instead of loading every sale row.
        const [revenueAgg, products, grouped] = await Promise.all([
          saleRepository.getRangeAggregate(ownerId, start, end),
          productRepository.getAll(ownerId),
          saleRepository.groupByProduct(ownerId, start, end),
        ]);

        const productMap = new Map<string, any>(products.map((p: any) => [p.id, p]));

        const totalRevenue = Number(revenueAgg._sum?.total_price) || 0;
        const totalCost = grouped.reduce((sum: number, g: any) => {
          const product = productMap.get(g.product_id);
          if (!product) return sum;
          return sum + (product.buying_price || 0) * (Number(g._sum?.quantity) || 0);
        }, 0);

        const grossProfit = totalRevenue - totalCost;
        const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
        const transactionCount = revenueAgg._count?._all ?? 0;
        const averageTransactionValue = transactionCount > 0 ? totalRevenue / transactionCount : 0;

        return {
          totalRevenue,
          totalCost,
          grossProfit,
          profitMargin,
          transactionCount,
          averageTransactionValue,
        };
      });
    },

    deadStockAnalysis: async (_: any, { startDate, endDate }: any, context: any) => {
      const user = requireRole(context, 'owner', 'manager');
      const ownerId = await getEffectiveOwnerId(context);

      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;
      if (end) end.setHours(23, 59, 59, 999);

      const keyBase = `${ownerId}::analysis:dead:${start?.getTime() ?? 0}:${end?.getTime() ?? 0}`;
      return memoize(keyBase, async () => {
        const products = await productRepository.getAll(ownerId);

        // Products that sold within the window (SQL groupBy, no full scan).
        const rangeStart = start ?? new Date(0);
        const rangeEnd = end ?? new Date();
        const soldInPeriod = new Set(
          (await saleRepository.groupByProduct(ownerId, rangeStart, rangeEnd)).map((g: any) => g.product_id),
        );

        const now = new Date();
        const deadStock: any[] = [];

        for (const product of products) {
          if (product.quantity <= 0) continue;
          if (soldInPeriod.has(product.id)) continue;
          const last = await saleRepository.getLastSaleByProduct(product.id, ownerId);
          const lastSale = last && last.length ? last[0] : null;
          let daysSinceLastSale: number | null = null;
          if (lastSale) {
            const lastSaleDate = new Date(lastSale.created_at);
            daysSinceLastSale = Math.floor((now.getTime() - lastSaleDate.getTime()) / (1000 * 60 * 60 * 24));
          } else {
            daysSinceLastSale = 999;
          }
          deadStock.push({
            productId: product.id,
            productName: product.name,
            quantity: product.quantity,
            category: product.category || '',
            lastSaleDate: lastSale?.created_at?.toISOString?.() || lastSale?.created_at || null,
            daysSinceLastSale,
          });
        }

        return deadStock.sort((a, b) => (b.daysSinceLastSale || 0) - (a.daysSinceLastSale || 0));
      });
    },

    profitabilityAnalysis: async (_: any, { startDate, endDate }: any, context: any) => {
      const user = requireRole(context, 'owner', 'manager');
      const ownerId = await getEffectiveOwnerId(context);
      const { start, end } = dateRange(startDate, endDate);

      return memoize(`${ownerId}::analysis:profit:${start.getTime()}:${end.getTime()}`, async () => {
        const [products, grouped] = await Promise.all([
          productRepository.getAll(ownerId),
          saleRepository.groupByProduct(ownerId, start, end),
        ]);
        const productMap = new Map<string, any>(products.map((p: any) => [p.id, p]));

        const profitability: any[] = [];
        for (const g of grouped) {
          const product = productMap.get(g.product_id);
          if (!product) continue;
          const revenue = Number(g._sum?.total_price) || 0;
          const unitsSold = Number(g._sum?.quantity) || 0;
          if (revenue <= 0) continue;
          const cost = (product.buying_price || 0) * unitsSold;
          const profit = revenue - cost;
          const marginPercent = (profit / revenue) * 100;
          profitability.push({
            productId: product.id,
            productName: product.name,
            category: product.category || '',
            revenue,
            cost,
            profit,
            marginPercent,
            unitsSold,
          });
        }

        return profitability.sort((a, b) => b.profit - a.profit);
      });
    },

    inventoryHealth: async (_: any, __: any, context: any) => {
      const user = requireRole(context, 'owner', 'manager');
      const ownerId = await getEffectiveOwnerId(context);

      return memoize(`${ownerId}::analysis:inventory`, async () => {
        const products = await productRepository.getAll(ownerId);

        const lowStock: any[] = [];
        const overstocked: any[] = [];
        const outOfStock: any[] = [];

        let inventoryValue = 0;
        let potentialProfit = 0;

        products.forEach((product: any) => {
          const value = (product.buying_price || 0) * product.quantity;
          const profit = ((product.selling_price || 0) - (product.buying_price || 0)) * product.quantity;
          inventoryValue += value;
          potentialProfit += profit;

          if (product.quantity === 0) {
            outOfStock.push({
              productId: product.id,
              productName: product.name,
              category: product.category || '',
              quantity: product.quantity,
              threshold: product.low_stock_threshold,
            });
          } else if (product.quantity <= product.low_stock_threshold) {
            lowStock.push({
              productId: product.id,
              productName: product.name,
              category: product.category || '',
              quantity: product.quantity,
              threshold: product.low_stock_threshold,
            });
          } else if (product.quantity > product.low_stock_threshold * 10) {
            overstocked.push({
              productId: product.id,
              productName: product.name,
              category: product.category || '',
              quantity: product.quantity,
              threshold: product.low_stock_threshold,
            });
          }
        });

        return {
          lowStock,
          overstocked,
          outOfStock,
          inventoryValue,
          potentialProfit,
        };
      });
    },

    businessInsights: async (_: any, { startDate, endDate }: any, context: any) => {
      const user = requireRole(context, 'owner', 'manager');
      const ownerId = await getEffectiveOwnerId(context);
      const { start, end } = dateRange(startDate, endDate);

      return memoize(`${ownerId}::analysis:insights:${start.getTime()}:${end.getTime()}`, async () => {
        const [products, grouped] = await Promise.all([
          productRepository.getAll(ownerId),
          saleRepository.groupByProduct(ownerId, start, end),
        ]);
        const productMap = new Map<string, any>(products.map((p: any) => [p.id, p]));

        const profitability: any[] = [];
        for (const g of grouped) {
          const product = productMap.get(g.product_id);
          if (!product) continue;
          const revenue = Number(g._sum?.total_price) || 0;
          const unitsSold = Number(g._sum?.quantity) || 0;
          if (revenue <= 0) continue;
          const cost = (product.buying_price || 0) * unitsSold;
          const profit = revenue - cost;
          const marginPercent = (profit / revenue) * 100;
          profitability.push({
            productId: product.id,
            productName: product.name,
            category: product.category || '',
            revenue,
            cost,
            profit,
            marginPercent,
            unitsSold,
          });
        }

        const sortedByRevenue = [...profitability].sort((a, b) => b.revenue - a.revenue);
        const sortedByProfit = [...profitability].sort((a, b) => b.profit - a.profit);
        const sortedByMargin = [...profitability].sort((a, b) => b.marginPercent - a.marginPercent);

        return {
          topRevenueProducts: sortedByRevenue.slice(0, 5),
          topProfitProducts: sortedByProfit.slice(0, 5),
          worstMarginProducts: sortedByMargin.slice(-5).reverse(),
        };
      });
    },
  },
};
