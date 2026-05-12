import { productRepository, saleRepository } from '../../repositories';
import { requireAuth } from '../../auth/context';

export const analysisResolvers = {
  Query: {
    salesAnalysis: async (_: any, { startDate, endDate }: any, context: any) => {
      const user = requireAuth(context);
      const products = await productRepository.getAll(user.id);

      const start = startDate ? new Date(startDate) : new Date(0);
      const end = endDate ? new Date(endDate) : new Date();
      end.setHours(23, 59, 59, 999);

      const sales = await saleRepository.getByDateRange(user.id, start, end);
      const productMap = new Map<string, any>(products.map((p: any) => [p.id, p]));

      const totalRevenue = sales.reduce((sum: number, s: any) => sum + s.total_price, 0);
      const totalCost = sales.reduce((sum: number, s: any) => {
        const product = productMap.get(s.product_id);
        if (!product) return sum;
        return sum + (product.buying_price || 0) * s.quantity;
      }, 0);

      const grossProfit = totalRevenue - totalCost;
      const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
      const transactionCount = sales.length;
      const averageTransactionValue = transactionCount > 0 ? totalRevenue / transactionCount : 0;

      return {
        totalRevenue,
        totalCost,
        grossProfit,
        profitMargin,
        transactionCount,
        averageTransactionValue
      };
    },

    deadStockAnalysis: async (_: any, { startDate, endDate }: any, context: any) => {
      const user = requireAuth(context);
      const products = await productRepository.getAll(user.id);
      const allSales = await saleRepository.getAll(user.id);

      const productSalesMap = new Map<string, any[]>();
      allSales.forEach((s: any) => {
        const existing = productSalesMap.get(s.product_id) || [];
        existing.push(s);
        productSalesMap.set(s.product_id, existing);
      });

      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;
      if (end) end.setHours(23, 59, 59, 999);

      const salesInPeriod = new Set(
        start || end
          ? allSales.filter((s: any) => {
              const saleDate = new Date(s.created_at);
              if (start && saleDate < start) return false;
              if (end && saleDate > end) return false;
              return true;
            }).map((s: any) => s.product_id)
          : allSales.map((s: any) => s.product_id)
      );

      const now = new Date();
      const deadStock: any[] = [];

      products.forEach((product: any) => {
        if (product.quantity > 0) {
          const hasSalesInPeriod = salesInPeriod.has(product.id);
          if (!hasSalesInPeriod) {
            const productSales = productSalesMap.get(product.id) || [];
            const lastSale = productSales.sort((a: any, b: any) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )[0];

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
              daysSinceLastSale
            });
          }
        }
      });

      return deadStock.sort((a, b) => (b.daysSinceLastSale || 0) - (a.daysSinceLastSale || 0));
    },

    profitabilityAnalysis: async (_: any, { startDate, endDate }: any, context: any) => {
      const user = requireAuth(context);
      const products = await productRepository.getAll(user.id);

      const start = startDate ? new Date(startDate) : new Date(0);
      const end = endDate ? new Date(endDate) : new Date();
      end.setHours(23, 59, 59, 999);

      const sales = await saleRepository.getByDateRange(user.id, start, end);
      const productMap = new Map<string, any>(products.map((p: any) => [p.id, p]));

      const productStats = new Map<string, {
        revenue: number;
        cost: number;
        unitsSold: number;
      }>();

      sales.forEach((s: any) => {
        const product = productMap.get(s.product_id);
        if (!product) return;

        const existing = productStats.get(s.product_id) || { revenue: 0, cost: 0, unitsSold: 0 };
        existing.revenue += s.total_price;
        existing.cost += (product.buying_price || 0) * s.quantity;
        existing.unitsSold += s.quantity;
        productStats.set(s.product_id, existing);
      });

      const profitability: any[] = [];
      products.forEach((product: any) => {
        const stats = productStats.get(product.id);
        if (stats && stats.revenue > 0) {
          const profit = stats.revenue - stats.cost;
          const marginPercent = (profit / stats.revenue) * 100;
          profitability.push({
            productId: product.id,
            productName: product.name,
            category: product.category || '',
            revenue: stats.revenue,
            cost: stats.cost,
            profit,
            marginPercent,
            unitsSold: stats.unitsSold
          });
        }
      });

      return profitability.sort((a, b) => b.profit - a.profit);
    },

    inventoryHealth: async (_: any, __: any, context: any) => {
      const user = requireAuth(context);
      const products = await productRepository.getAll(user.id);

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
            threshold: product.low_stock_threshold
          });
        } else if (product.quantity <= product.low_stock_threshold) {
          lowStock.push({
            productId: product.id,
            productName: product.name,
            category: product.category || '',
            quantity: product.quantity,
            threshold: product.low_stock_threshold
          });
        } else if (product.quantity > product.low_stock_threshold * 10) {
          overstocked.push({
            productId: product.id,
            productName: product.name,
            category: product.category || '',
            quantity: product.quantity,
            threshold: product.low_stock_threshold
          });
        }
      });

      return {
        lowStock,
        overstocked,
        outOfStock,
        inventoryValue,
        potentialProfit
      };
    },

    businessInsights: async (_: any, { startDate, endDate }: any, context: any) => {
      const user = requireAuth(context);
      const products = await productRepository.getAll(user.id);

      const start = startDate ? new Date(startDate) : new Date(0);
      const end = endDate ? new Date(endDate) : new Date();
      end.setHours(23, 59, 59, 999);

      const sales = await saleRepository.getByDateRange(user.id, start, end);
      const productMap = new Map<string, any>(products.map((p: any) => [p.id, p]));

      const productStats = new Map<string, {
        revenue: number;
        cost: number;
        unitsSold: number;
      }>();

      sales.forEach((s: any) => {
        const product = productMap.get(s.product_id);
        if (!product) return;

        const existing = productStats.get(s.product_id) || { revenue: 0, cost: 0, unitsSold: 0 };
        existing.revenue += s.total_price;
        existing.cost += (product.buying_price || 0) * s.quantity;
        existing.unitsSold += s.quantity;
        productStats.set(s.product_id, existing);
      });

      const profitability: any[] = [];
      products.forEach((product: any) => {
        const stats = productStats.get(product.id);
        if (stats && stats.revenue > 0) {
          const profit = stats.revenue - stats.cost;
          const marginPercent = (profit / stats.revenue) * 100;
          profitability.push({
            productId: product.id,
            productName: product.name,
            category: product.category || '',
            revenue: stats.revenue,
            cost: stats.cost,
            profit,
            marginPercent,
            unitsSold: stats.unitsSold
          });
        }
      });

      const sortedByRevenue = [...profitability].sort((a, b) => b.revenue - a.revenue);
      const sortedByProfit = [...profitability].sort((a, b) => b.profit - a.profit);
      const sortedByMargin = [...profitability].sort((a, b) => b.marginPercent - a.marginPercent);

      return {
        topRevenueProducts: sortedByRevenue.slice(0, 5),
        topProfitProducts: sortedByProfit.slice(0, 5),
        worstMarginProducts: sortedByMargin.slice(-5).reverse()
      };
    }
  }
};
