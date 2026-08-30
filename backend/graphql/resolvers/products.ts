import prisma from '../../prisma';
import { productRepository, saleRepository, stockRepository } from '../../repositories';
import { requireAuth, requireRole, getEffectiveOwnerId } from '../../auth/context';
import { invalidateOwner } from '../../lib/cache';
import {
  mondayOf,
  weekdayIndexOf,
  deriveSalesForWeek,
  syncProductQuantities,
  getProductWeekDays,
  recomputeWeekDays,
  saveProductWeekSuffix,
  createOrder,
  rebuildWeekFromInputs,
} from '../../services/stockService';

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
    recordSale: async (_: any, { productId, quantity, totalPrice, recordOrder }: any, context: any) => {
      const user = requireAuth(context);
      const ownerId = await getEffectiveOwnerId(context);

      const product = await productRepository.getById(productId, ownerId);
      if (!product) {
        throw new Error('PRODUCT_NOT_FOUND');
      }
      // record personnel can sell; this mutation only writes into the current week's sheet
      const qty = Math.max(0, Math.floor(quantity || 0));
      if (qty <= 0) {
        throw new Error('Quantity must be greater than zero');
      }

      // Availability is driven by the latest saved Baki (products.quantity is kept in sync).
      const available = Number(product.quantity) || 0;
      if (available === 0) {
        throw new Error('OUT_OF_STOCK');
      }
      if (qty > available) {
        throw new Error(`INSUFFICIENT_STOCK:${available}`);
      }

      const today = new Date();
      const weekStart = mondayOf(today);
      const weekday = weekdayIndexOf(today);

      const sale = await prisma.$transaction(async (tx) => {
        let days = await getProductWeekDays(ownerId, weekStart, productId, tx);
        const hasAnyData = days.some((d) => d.in > 0 || d.uza > 0 || d.jumla > 0 || d.baki > 0);
        let fromIndex = weekday;
        if (!hasAnyData) {
          // Seed this week's opening stock from the latest saved Baki (carry-in).
          days[0] = { ...days[0], in: available, jumla: available, baki: available };
          // Seeding changed day 0 as well, so persist from the start.
          fromIndex = 0;
        }

        days[weekday].uza += qty;
        days = recomputeWeekDays(days);

        // Persist only the days that actually changed (the cascade writes from
        // `fromIndex` onward) instead of deleting/recreating all 7 rows.
        await saveProductWeekSuffix(ownerId, weekStart, productId, fromIndex, days, tx);

        const soldDate = new Date(weekStart);
        soldDate.setDate(weekStart.getDate() + weekday);

        // Update only this product's derived sale row (the whole-week re-derive
        // was heavy: this product is the only one that changed this call).
        const soldQty = days[weekday].uza;
        const soldPrice = (Number(product.selling_price) || 0) * soldQty;
        let saleId = '';
        await tx.sale.deleteMany({
          where: { owner_id: ownerId, product_id: productId, created_at: soldDate },
        });
        if (soldQty > 0) {
          const created = await tx.sale.create({
            data: {
              owner_id: ownerId,
              product_id: productId,
              quantity: soldQty,
              total_price: soldPrice,
              created_at: soldDate,
            },
          });
          saleId = created.id;
        }

        // Sync only this product's quantity to its latest (final) Baki.
        await tx.product.update({
          where: { id: productId },
          data: { quantity: days[days.length - 1]?.baki ?? 0 },
        });

        if (recordOrder) {
          await createOrder(ownerId, tx);
        }

        return {
          id: saleId,
          product_id: productId,
          quantity: soldQty,
          total_price: soldPrice,
          created_at: soldDate,
        };
      });

      invalidateOwner(ownerId);
      return sale;
    },
    saveStockSheet: async (_: any, { weekDate, entries }: any, context: any) => {
      const user = requireRole(context, 'owner', 'manager');
      const ownerId = await getEffectiveOwnerId(context);

      const products = await productRepository.getAll(ownerId);
      const validIds = new Set(products.map((p: any) => p.id));

      const cleaned = (entries as any[]).filter((e) => validIds.has(e.productId));

      const weekStart = mondayOf(new Date(weekDate));

      // The frontend only sends raw `in`/`uza` values; the backend recomputes
      // jumla/baki (single source of truth) and returns the canonical week.
      const rebuilt = await prisma.$transaction(async (tx) => {
        const weekRows = await rebuildWeekFromInputs(
          ownerId,
          weekStart,
          cleaned.map((e) => ({
            productId: e.productId,
            weekday: Math.min(6, Math.max(0, Math.floor(e.weekday || 0))),
            in: Math.floor(e.in || 0),
            uza: Math.floor(e.uza || 0),
          })),
          [...validIds],
          tx,
        );

        await deriveSalesForWeek(ownerId, weekStart, tx);
        await syncProductQuantities(ownerId, tx);

        return weekRows;
      });

      invalidateOwner(ownerId);

      return rebuilt.map((e) => ({
        id: `${e.productId}:${e.weekday}`,
        productId: e.productId,
        weekday: e.weekday,
        in: e.in,
        jumla: e.jumla,
        uza: e.uza,
        baki: e.baki,
      }));
    }
  }
};