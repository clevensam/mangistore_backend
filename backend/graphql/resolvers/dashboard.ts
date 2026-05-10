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

export const dashboardResolvers = {
  Query: {
    dashboardData: async () => {
      const products = await productRepository.getAll();
      const sales = await saleRepository.getAll();

      const productMap = new Map<string, Product>(products.map((p: Product) => [p.id, p]));

      const today = new Date().toISOString().split('T')[0];
      const todayStart = new Date(today);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(today);
      todayEnd.setHours(23, 59, 59, 999);

      const todaySales = sales.filter((s: Sale) => {
        const saleDate = new Date(s.created_at);
        return saleDate >= todayStart && saleDate <= todayEnd;
      });

      const todaySalesTotal = todaySales.reduce((sum: number, s: Sale) => sum + s.total_price, 0);
      const todayOrderCount = todaySales.length;

      const lowStockCount = products.filter((p: Product) => p.quantity <= p.low_stock_threshold && p.quantity > 0).length;
      
      const inventoryValue = products.reduce((sum: number, p: Product) => {
        return sum + (p.buying_price || 0) * p.quantity;
      }, 0);

      const last7Days: { date: string; total: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const dayStart = new Date(dateStr);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dateStr);
        dayEnd.setHours(23, 59, 59, 999);

        const daySales = sales.filter((s: Sale) => {
          const saleDate = new Date(s.created_at);
          return saleDate >= dayStart && saleDate <= dayEnd;
        });

        const dayTotal = daySales.reduce((sum: number, s: Sale) => sum + s.total_price, 0);
        
        last7Days.push({
          date: date.toLocaleDateString('en-US', { weekday: 'short' }),
          total: dayTotal
        });
      }

      const last7DaysStart = new Date();
      last7DaysStart.setDate(last7DaysStart.getDate() - 7);
      last7DaysStart.setHours(0, 0, 0, 0);

      const recentPeriodSales = sales.filter((s: Sale) => new Date(s.created_at) >= last7DaysStart);

      const productRevenue = new Map<string, { revenue: number; quantity: number; name: string }>();
      
      recentPeriodSales.forEach((s: Sale) => {
        const product = productMap.get(s.product_id);
        if (!product) return;
        
        const existing = productRevenue.get(s.product_id) || { revenue: 0, quantity: 0, name: product.name };
        existing.revenue += s.total_price;
        existing.quantity += s.quantity;
        productRevenue.set(s.product_id, existing);
      });

      const topProducts = Array.from(productRevenue.entries())
        .map(([productId, data]) => ({
          productId,
          productName: data.name,
          revenue: data.revenue,
          quantity: data.quantity
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      const recentTransactions = sales
        .sort((a: Sale, b: Sale) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5)
        .map((s: Sale) => {
          const product = productMap.get(s.product_id);
          return {
            id: s.id,
            productId: s.product_id,
            productName: product?.name || 'Unknown',
            quantity: s.quantity,
            totalPrice: s.total_price,
            createdAt: s.created_at
          };
        });

      const lowStockProducts = products
        .filter((p: Product) => p.quantity <= p.low_stock_threshold && p.quantity > 0)
        .map((p: Product) => ({
          productId: p.id,
          productName: p.name,
          quantity: p.quantity,
          threshold: p.low_stock_threshold,
          category: p.category
        }))
        .slice(0, 5);

      return {
        stats: {
          todaySales: todaySalesTotal,
          todayOrderCount,
          lowStockCount,
          inventoryValue
        },
        weeklySales: last7Days,
        topProducts,
        recentTransactions,
        lowStockProducts
      };
    }
  }
};