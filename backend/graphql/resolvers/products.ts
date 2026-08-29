import { productRepository, saleRepository, stockRepository } from '../../repositories';
import { requireAuth, requireRole, getEffectiveOwnerId } from '../../auth/context';

export const productResolvers = {
  Query: {
    products: async (_: any, __: any, context: any) => {
      const user = requireAuth(context);
      const ownerId = await getEffectiveOwnerId(context);
      const products = await productRepository.getAll(ownerId);
      return products.map((p: any) => ({
        id: p.id,
        name: p.name,
        category: p.category || '',
        buying_price: p.buying_price,
        selling_price: p.selling_price,
        quantity: p.quantity,
        low_stock_threshold: p.low_stock_threshold,
        created_at: p.created_at
      }));
    },
    sales: async (_: any, { startDate, endDate }: any, context: any) => {
      const user = requireAuth(context);
      const ownerId = await getEffectiveOwnerId(context);

      const start = startDate ? new Date(startDate) : new Date(0);
      const end = endDate ? new Date(endDate) : new Date();
      end.setHours(23, 59, 59, 999);

      const sales = await saleRepository.getByDateRange(ownerId, start, end);
      return sales.map((s: any) => ({
        id: s.id,
        product_id: s.product_id,
        quantity: s.quantity,
        total_price: s.total_price,
        created_at: s.created_at
      }));
    },
    product: async (_: any, { id }: any, context: any) => {
      const user = requireAuth(context);
      const ownerId = await getEffectiveOwnerId(context);
      const p = await productRepository.getById(id, ownerId);
      if (!p) return null;
      return {
        id: p.id,
        name: p.name,
        category: p.category || '',
        buying_price: p.buying_price,
        selling_price: p.selling_price,
        quantity: p.quantity,
        low_stock_threshold: p.low_stock_threshold,
        created_at: p.created_at
      };
    },
    productSales: async (_: any, { productId }: any, context: any) => {
      const user = requireAuth(context);
      const ownerId = await getEffectiveOwnerId(context);
      const sales = await saleRepository.getByProductId(productId, ownerId);
      return sales.map((s: any) => ({
        id: s.id,
        product_id: s.product_id,
        quantity: s.quantity,
        total_price: s.total_price,
        created_at: s.created_at
      }));
    },
    salesReport: async (_: any, { startDate, endDate }: any, context: any) => {
      const user = requireAuth(context);
      const ownerId = await getEffectiveOwnerId(context);
      const start = new Date(startDate);
      const end = new Date(endDate);
      return saleRepository.getSalesReport(ownerId, start, end);
    },
    stockSheet: async (_: any, { weekDate }: any, context: any) => {
      const user = requireAuth(context);
      const ownerId = await getEffectiveOwnerId(context);
      const weekStart = new Date(weekDate);
      weekStart.setHours(0, 0, 0, 0);
      const entries = await stockRepository.getForWeek(ownerId, weekStart);
      return entries.map((e: any) => ({
        id: e.id,
        productId: e.product_id,
        weekday: e.weekday,
        in: e.in,
        jumla: e.jumla,
        uza: e.uza,
        baki: e.baki,
      }));
    },
    latestStockBaki: async (_: any, __: any, context: any) => {
      const user = requireAuth(context);
      const ownerId = await getEffectiveOwnerId(context);
      const latest = await stockRepository.getLatestBaki(ownerId);
      return latest.map((e: any) => ({
        productId: e.product_id,
        productName: e.product.name,
        category: e.product.category || '',
        baki: e.baki,
        weekDate: e.week_date.toISOString(),
      }));
    }
  },
  Mutation: {
    createProduct: async (_: any, args: any, context: any) => {
      const user = requireRole(context, 'owner', 'manager');
      const ownerId = await getEffectiveOwnerId(context);
      const { buying_price, selling_price } = args;
      if (selling_price !== undefined && buying_price !== undefined && selling_price <= buying_price) {
        throw new Error('Selling price must be greater than buying price');
      }
      const product = await productRepository.create({ ...args, owner_id: ownerId });
      return {
        id: product.id,
        name: product.name,
        category: product.category || '',
        buying_price: product.buying_price,
        selling_price: product.selling_price,
        quantity: product.quantity,
        low_stock_threshold: product.low_stock_threshold,
        created_at: product.created_at
      };
    },
    updateProduct: async (_: any, { id, ...updates }: any, context: any) => {
      const user = requireRole(context, 'owner', 'manager');
      const ownerId = await getEffectiveOwnerId(context);
      const { buying_price, selling_price } = updates;
      if (selling_price !== undefined && buying_price !== undefined && selling_price <= buying_price) {
        throw new Error('Selling price must be greater than buying price');
      }
      const product = await productRepository.update(id, ownerId, updates);
      return {
        id: product.id,
        name: product.name,
        category: product.category || '',
        buying_price: product.buying_price,
        selling_price: product.selling_price,
        quantity: product.quantity,
        low_stock_threshold: product.low_stock_threshold,
        created_at: product.created_at
      };
    },
    deleteProduct: async (_: any, { id }: any, context: any) => {
      const user = requireRole(context, 'owner', 'manager');
      const ownerId = await getEffectiveOwnerId(context);
      try {
        return await productRepository.delete(id, ownerId);
      } catch (error: any) {
        const errorCode = error?.code || error?.message || '';
        if (errorCode === '23503' || String(errorCode).includes('23503')) {
          throw new Error('Cannot delete product with existing sales records. Please delete all related sales first.');
        }
        throw error;
      }
    },
    recordSale: async (_: any, { productId, quantity, totalPrice }: any, context: any) => {
      const user = requireAuth(context);
      const ownerId = await getEffectiveOwnerId(context);
      try {
        const sale = await saleRepository.recordSale(ownerId, productId, quantity, totalPrice);
        return {
          id: sale.id,
          product_id: sale.product_id,
          quantity: sale.quantity,
          total_price: sale.total_price,
          created_at: sale.created_at
        };
      } catch (error: any) {
        const message = error.message || '';

        if (message === 'PRODUCT_NOT_FOUND') {
          throw new Error('Product not found');
        }

        if (message === 'OUT_OF_STOCK') {
          throw new Error('This product is out of stock');
        }

        if (message.startsWith('INSUFFICIENT_STOCK:')) {
          const available = message.split(':')[1];
          throw new Error(`Insufficient stock. Only ${available} available`);
        }

        if (message === 'SALE_RECORD_FAILED') {
          throw new Error('Failed to record sale. Please try again');
        }

        if (message === 'STOCK_UPDATE_FAILED') {
          throw new Error('Failed to update stock. Sale was not recorded');
        }

        throw error;
      }
    },
    saveStockSheet: async (_: any, { weekDate, entries }: any, context: any) => {
      const user = requireRole(context, 'owner', 'manager');
      const ownerId = await getEffectiveOwnerId(context);

      const products = await productRepository.getAll(ownerId);
      const validIds = new Set(products.map((p: any) => p.id));

      const cleaned = (entries as any[]).filter((e) => validIds.has(e.productId));

      const weekStart = new Date(weekDate);
      weekStart.setHours(0, 0, 0, 0);

      await stockRepository.upsertAll(
        ownerId,
        weekStart,
        cleaned.map((e) => ({
          productId: e.productId,
          weekday: Math.min(6, Math.max(0, Math.floor(e.weekday || 0))),
          in: Math.floor(e.in || 0),
          jumla: Math.floor(e.jumla || 0),
          uza: Math.floor(e.uza || 0),
          baki: Math.floor(e.baki || 0),
        })),
        [...validIds],
      );

      return true;
    }
  }
};