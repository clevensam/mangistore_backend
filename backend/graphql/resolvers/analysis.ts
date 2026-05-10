import { productRepository, saleRepository } from '../../repositories';

interface Product {
  id: string;
  name: string;
  category: string;
  buying_price: number;
  selling_price: number;
  quantity: number;
  low_stock_threshold: number;
}

interface Sale {
  id: string;
  product_id: string;
  quantity: number;
  total_price: number;
  created_at: string;
}

export const analysisResolvers = {
  Query: {
    salesAnalysis: async (_: any, { startDate, endDate }: any) => {
      const products = await productRepository.getAll();
      const sales = await saleRepository.getAll();

      const productMap = new Map<string, Product>(products.map((p: Product) => [p.id, p]));

      let filteredSales = sales;
      if (startDate || endDate) {
        filteredSales = sales.filter((s: Sale) => {
          const saleDate = new Date(s.created_at);
          const start = startDate ? new Date(startDate) : null;
          const end = endDate ? new Date(endDate) : null;

          if (start && saleDate < start) return false;
          if (end && saleDate > end) return false;
          return true;
        });
      }

      const totalRevenue = filteredSales.reduce((sum: number, s: Sale) => sum + s.total_price, 0);
      const totalCost = filteredSales.reduce((sum: number, s: Sale) => {
        const product = productMap.get(s.product_id);
        if (!product) return sum;
        return sum + (product.buying_price || 0) * s.quantity;
      }, 0);

      const grossProfit = totalRevenue - totalCost;
      const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
      const transactionCount = filteredSales.length;
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

    deadStockAnalysis: async (_: any, { startDate, endDate }: any) => {
      const products = await productRepository.getAll();
      const sales = await saleRepository.getAll();

      const productSalesMap = new Map<string, Sale[]>();
      sales.forEach((s: Sale) => {
        const existing = productSalesMap.get(s.product_id) || [];
        existing.push(s);
        productSalesMap.set(s.product_id, existing);
      });

      let filteredSales = sales;
      if (startDate || endDate) {
        filteredSales = sales.filter((s: Sale) => {
          const saleDate = new Date(s.created_at);
          const start = startDate ? new Date(startDate) : null;
          const end = endDate ? new Date(endDate) : null;

          if (start && saleDate < start) return false;
          if (end && saleDate > end) return false;
          return true;
        });
      }

      const salesInPeriod = new Set(filteredSales.map((s: Sale) => s.product_id));

      const now = new Date();
      const deadStock: any[] = [];

      products.forEach((product: Product) => {
        if (product.quantity > 0) {
          const hasSalesInPeriod = salesInPeriod.has(product.id);
          if (!hasSalesInPeriod) {
            const productSales = productSalesMap.get(product.id) || [];
            const lastSale = productSales.sort((a: Sale, b: Sale) => 
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
              category: product.category,
              lastSaleDate: lastSale?.created_at || null,
              daysSinceLastSale
            });
          }
        }
      });

      return deadStock.sort((a, b) => (b.daysSinceLastSale || 0) - (a.daysSinceLastSale || 0));
    },

    profitabilityAnalysis: async (_: any, { startDate, endDate }: any) => {
      const products = await productRepository.getAll();
      const sales = await saleRepository.getAll();

      const productMap = new Map<string, Product>(products.map((p: Product) => [p.id, p]));

      let filteredSales = sales;
      if (startDate || endDate) {
        filteredSales = sales.filter((s: Sale) => {
          const saleDate = new Date(s.created_at);
          const start = startDate ? new Date(startDate) : null;
          const end = endDate ? new Date(endDate) : null;

          if (start && saleDate < start) return false;
          if (end && saleDate > end) return false;
          return true;
        });
      }

      const productStats = new Map<string, {
        revenue: number;
        cost: number;
        unitsSold: number;
      }>();

      filteredSales.forEach((s: Sale) => {
        const product = productMap.get(s.product_id);
        if (!product) return;

        const existing = productStats.get(s.product_id) || { revenue: 0, cost: 0, unitsSold: 0 };
        existing.revenue += s.total_price;
        existing.cost += (product.buying_price || 0) * s.quantity;
        existing.unitsSold += s.quantity;
        productStats.set(s.product_id, existing);
      });

      const profitability: any[] = [];
      products.forEach((product: Product) => {
        const stats = productStats.get(product.id);
        if (stats && stats.revenue > 0) {
          const profit = stats.revenue - stats.cost;
          const marginPercent = (profit / stats.revenue) * 100;
          profitability.push({
            productId: product.id,
            productName: product.name,
            category: product.category,
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

    inventoryHealth: async () => {
      const products = await productRepository.getAll();

      const lowStock: any[] = [];
      const overstocked: any[] = [];
      const outOfStock: any[] = [];

      let inventoryValue = 0;
      let potentialProfit = 0;

      products.forEach((product: Product) => {
        const value = (product.buying_price || 0) * product.quantity;
        const profit = ((product.selling_price || 0) - (product.buying_price || 0)) * product.quantity;
        inventoryValue += value;
        potentialProfit += profit;

        if (product.quantity === 0) {
          outOfStock.push({
            productId: product.id,
            productName: product.name,
            category: product.category,
            quantity: product.quantity,
            threshold: product.low_stock_threshold
          });
        } else if (product.quantity <= product.low_stock_threshold) {
          lowStock.push({
            productId: product.id,
            productName: product.name,
            category: product.category,
            quantity: product.quantity,
            threshold: product.low_stock_threshold
          });
        } else if (product.quantity > product.low_stock_threshold * 10) {
          overstocked.push({
            productId: product.id,
            productName: product.name,
            category: product.category,
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

    businessInsights: async (_: any, { startDate, endDate }: any) => {
      const products = await productRepository.getAll();
      const sales = await saleRepository.getAll();

      const productMap = new Map<string, Product>(products.map((p: Product) => [p.id, p]));

      let filteredSales = sales;
      if (startDate || endDate) {
        filteredSales = sales.filter((s: Sale) => {
          const saleDate = new Date(s.created_at);
          const start = startDate ? new Date(startDate) : null;
          const end = endDate ? new Date(endDate) : null;

          if (start && saleDate < start) return false;
          if (end && saleDate > end) return false;
          return true;
        });
      }

      const productStats = new Map<string, {
        revenue: number;
        cost: number;
        unitsSold: number;
      }>();

      filteredSales.forEach((s: Sale) => {
        const product = productMap.get(s.product_id);
        if (!product) return;

        const existing = productStats.get(s.product_id) || { revenue: 0, cost: 0, unitsSold: 0 };
        existing.revenue += s.total_price;
        existing.cost += (product.buying_price || 0) * s.quantity;
        existing.unitsSold += s.quantity;
        productStats.set(s.product_id, existing);
      });

      const profitability: any[] = [];
      products.forEach((product: Product) => {
        const stats = productStats.get(product.id);
        if (stats && stats.revenue > 0) {
          const profit = stats.revenue - stats.cost;
          const marginPercent = (profit / stats.revenue) * 100;
          profitability.push({
            productId: product.id,
            productName: product.name,
            category: product.category,
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