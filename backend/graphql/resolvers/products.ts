import { productRepository, saleRepository } from '../../repositories';

export const productResolvers = {
  Query: {
    products: async () => {
      const products = await productRepository.getAll();
      return products.map(p => ({
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
    sales: async (_: any, { startDate, endDate }: any) => {
      const sales = await saleRepository.getAll();
      let filtered = sales;
      
      if (startDate || endDate) {
        filtered = sales.filter((s: any) => {
          const saleDate = new Date(s.created_at);
          const start = startDate ? new Date(startDate) : null;
          const end = endDate ? new Date(endDate) : null;
          
          if (start && saleDate < start) return false;
          if (end && saleDate > end) return false;
          return true;
        });
      }
      
      return filtered.map((s: any) => ({
        id: s.id,
        product_id: s.product_id,
        quantity: s.quantity,
        total_price: s.total_price,
        created_at: s.created_at
      }));
    },
    product: async (_: any, { id }: any) => {
      const p = await productRepository.getById(id);
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
    productSales: async (_: any, { productId }: any) => {
      const sales = await saleRepository.getByProductId(productId);
      return sales.map(s => ({
        id: s.id,
        product_id: s.product_id,
        quantity: s.quantity,
        total_price: s.total_price,
        created_at: s.created_at
      }));
    }
  },
  Mutation: {
    createProduct: async (_: any, args: any) => {
      const { buying_price, selling_price } = args;
      if (selling_price !== undefined && buying_price !== undefined && selling_price <= buying_price) {
        throw new Error('Selling price must be greater than buying price');
      }
      const product = await productRepository.create(args);
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
    updateProduct: async (_: any, { id, ...updates }: any) => {
      const { buying_price, selling_price } = updates;
      if (selling_price !== undefined && buying_price !== undefined && selling_price <= buying_price) {
        throw new Error('Selling price must be greater than buying price');
      }
      const product = await productRepository.update(id, updates);
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
    deleteProduct: async (_: any, { id }: any) => {
      try {
        return await productRepository.delete(id);
      } catch (error: any) {
        const errorCode = error?.code || error?.message || '';
        if (errorCode === '23503' || String(errorCode).includes('23503')) {
          throw new Error('Cannot delete product with existing sales records. Please delete all related sales first.');
        }
        throw error;
      }
    },
    recordSale: async (_: any, { productId, quantity, totalPrice }: any) => {
      try {
        const sale = await saleRepository.recordSale(productId, quantity, totalPrice);
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
    }
  }
};