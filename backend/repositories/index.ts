import prisma from '../prisma';

export interface ProductInput {
  name: string;
  category: string;
  buying_price: number;
  selling_price: number;
  quantity: number;
  low_stock_threshold: number;
  owner_id: string;
}

export class ProductRepository {
  async getAll(ownerId: string) {
    return prisma.product.findMany({
      where: { owner_id: ownerId },
      orderBy: { name: 'asc' }
    });
  }

  async getById(id: string, ownerId: string) {
    return prisma.product.findFirst({
      where: { id, owner_id: ownerId }
    });
  }

  async create(input: ProductInput) {
    return prisma.product.create({
      data: {
        name: input.name,
        category: input.category,
        buying_price: input.buying_price,
        selling_price: input.selling_price,
        quantity: input.quantity,
        low_stock_threshold: input.low_stock_threshold,
        owner_id: input.owner_id
      }
    });
  }

  async update(id: string, ownerId: string, updates: Partial<ProductInput>) {
    const existing = await this.getById(id, ownerId);
    if (!existing) throw new Error('Product not found');
    return prisma.product.update({
      where: { id },
      data: updates
    });
  }

  async delete(id: string, ownerId: string) {
    const existing = await this.getById(id, ownerId);
    if (!existing) throw new Error('Product not found');
    await prisma.product.delete({ where: { id } });
    return true;
  }

  async decrementQuantity(id: string, ownerId: string, quantity: number) {
    const product = await this.getById(id, ownerId);
    if (!product) throw new Error('Product not found');

    if (product.quantity < quantity) {
      throw new Error(`INSUFFICIENT_STOCK:${product.quantity}`);
    }

    await prisma.product.update({
      where: { id },
      data: { quantity: product.quantity - quantity }
    });
    return true;
  }
}

export class SaleRepository {
  async getAll(ownerId: string) {
    return prisma.sale.findMany({
      where: { owner_id: ownerId },
      orderBy: { created_at: 'desc' }
    });
  }

  async getByDateRange(ownerId: string, start: Date, end: Date) {
    return prisma.sale.findMany({
      where: {
        owner_id: ownerId,
        created_at: { gte: start, lte: end },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  // Aggregate total revenue + count within a range (SQL aggregate).
  async getRangeAggregate(ownerId: string, start: Date, end: Date) {
    return prisma.sale.aggregate({
      where: {
        owner_id: ownerId,
        created_at: { gte: start, lte: end },
      },
      _sum: { total_price: true },
      _count: { _all: true },
    });
  }

  // Latest sale row for a single product (for "days since last sale").
  async getLastSaleByProduct(productId: string, ownerId: string) {
    return prisma.sale.findMany({
      where: { product_id: productId, owner_id: ownerId },
      orderBy: { created_at: 'desc' },
      take: 1,
      select: { created_at: true },
    });
  }

  // Sum of total_price within a range — done in the DB, not in JS.
  async sumTotalInRange(ownerId: string, start: Date, end: Date): Promise<number> {
    const result = await prisma.sale.aggregate({
      where: {
        owner_id: ownerId,
        created_at: { gte: start, lte: end },
      },
      _sum: { total_price: true },
      _count: { _all: true },
    });
    return Number(result._sum.total_price) || 0;
  }

  // Small projection of sales within a range (only columns needed for grouping).
  async getSummaryInRange(ownerId: string, start: Date, end: Date) {
    return prisma.sale.findMany({
      where: {
        owner_id: ownerId,
        created_at: { gte: start, lte: end },
      },
      select: {
        id: true,
        product_id: true,
        quantity: true,
        total_price: true,
        created_at: true,
      },
    });
  }

  // Aggregate total revenue + quantity per product within a range (SQL groupBy).
  async groupByProduct(ownerId: string, start: Date, end?: Date) {
    return prisma.sale.groupBy({
      by: ['product_id'],
      where: {
        owner_id: ownerId,
        created_at: { gte: start, ...(end ? { lte: end } : {}) },
      },
      _sum: { total_price: true, quantity: true },
    });
  }

  // Latest sales (recent transactions) with product name.
  async getRecent(ownerId: string, take = 5) {
    return prisma.sale.findMany({
      where: { owner_id: ownerId },
      orderBy: { created_at: 'desc' },
      take,
      include: { product: { select: { name: true } } },
    });
  }

  async getByProductId(productId: string, ownerId: string) {
    return prisma.sale.findMany({
      where: { product_id: productId, owner_id: ownerId },
      orderBy: { created_at: 'desc' }
    });
  }

  async create(ownerId: string, sale: { product_id: string; quantity: number; total_price: number }) {
    return prisma.sale.create({
      data: {
        product_id: sale.product_id,
        quantity: sale.quantity,
        total_price: sale.total_price,
        owner_id: ownerId
      }
    });
  }

  async getSalesReport(ownerId: string, startDate: Date, endDate: Date) {
    const sales = await prisma.sale.findMany({
      where: {
        owner_id: ownerId,
        created_at: { gte: startDate, lte: endDate },
      },
      include: {
        product: {
          select: { name: true, buying_price: true },
        },
      },
    });

    const grouped: Record<string, {
      productId: string;
      productName: string;
      totalQuantity: number;
      totalRevenue: number;
      totalCost: number;
    }> = {};

    for (const sale of sales) {
      const key = sale.product_id;
      if (!grouped[key]) {
        grouped[key] = {
          productId: key,
          productName: sale.product.name,
          totalQuantity: 0,
          totalRevenue: 0,
          totalCost: 0,
        };
      }
      grouped[key].totalQuantity += sale.quantity;
      grouped[key].totalRevenue += Number(sale.total_price);
      grouped[key].totalCost += (sale.product.buying_price || 0) * sale.quantity;
    }

    const items = Object.values(grouped)
      .map(item => ({
        ...item,
        totalProfit: item.totalRevenue - item.totalCost,
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    const summary = items.reduce(
      (acc, item) => ({
        totalRevenue: acc.totalRevenue + item.totalRevenue,
        totalQuantity: acc.totalQuantity + item.totalQuantity,
        totalProfit: acc.totalProfit + item.totalProfit,
      }),
      { totalRevenue: 0, totalQuantity: 0, totalProfit: 0 },
    );

    return { items, summary };
  }

  async recordSale(ownerId: string, productId: string, quantity: number, totalPrice: number) {
    const product = await prisma.product.findFirst({
      where: { id: productId, owner_id: ownerId }
    });

    if (!product) {
      throw new Error('PRODUCT_NOT_FOUND');
    }

    if (product.quantity < quantity) {
      throw new Error(`INSUFFICIENT_STOCK:${product.quantity}`);
    }

    if (product.quantity === 0) {
      throw new Error('OUT_OF_STOCK');
    }

    const sale = await prisma.sale.create({
      data: {
        product_id: productId,
        quantity,
        total_price: totalPrice,
        owner_id: ownerId
      }
    });

    await prisma.product.update({
      where: { id: productId },
      data: { quantity: product.quantity - quantity }
    });

    return sale;
  }
}

export const productRepository = new ProductRepository();
export const saleRepository = new SaleRepository();

export interface OperatingExpenseInput {
  category: string;
  description?: string;
  amount: number;
  expense_date: string;
  status: string;
  owner_id: string;
}

export class OperatingExpenseRepository {
  async getAll(ownerId: string) {
    return prisma.operatingExpense.findMany({
      where: { owner_id: ownerId },
      orderBy: { expense_date: 'desc' }
    });
  }

  async getByCategory(ownerId: string, category: string) {
    return prisma.operatingExpense.findMany({
      where: { owner_id: ownerId, category },
      orderBy: { expense_date: 'desc' }
    });
  }

  async create(input: OperatingExpenseInput) {
    return prisma.operatingExpense.create({
      data: {
        category: input.category,
        description: input.description || null,
        amount: input.amount,
        expense_date: new Date(input.expense_date),
        status: input.status,
        owner_id: input.owner_id
      }
    });
  }

  async getById(id: string, ownerId: string) {
    return prisma.operatingExpense.findFirst({
      where: { id, owner_id: ownerId }
    });
  }

  async update(id: string, ownerId: string, updates: Partial<OperatingExpenseInput>) {
    const existing = await this.getById(id, ownerId);
    if (!existing) throw new Error('Expense not found');
    const data: any = { ...updates };
    if (updates.expense_date) {
      data.expense_date = new Date(updates.expense_date);
    }
    return prisma.operatingExpense.update({
      where: { id },
      data
    });
  }

  async delete(id: string, ownerId: string) {
    const existing = await this.getById(id, ownerId);
    if (!existing) throw new Error('Expense not found');
    await prisma.operatingExpense.delete({ where: { id } });
    return true;
  }

  async getTotalByCategory(ownerId: string) {
    const expenses = await prisma.operatingExpense.findMany({
      where: { owner_id: ownerId },
      select: { category: true, amount: true }
    });

    const totals: Record<string, number> = {};
    expenses.forEach((item: any) => {
      totals[item.category] = (totals[item.category] || 0) + Number(item.amount);
    });
    return totals;
  }

  async getMonthlyTotal(ownerId: string, year: number, month: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = month === 12
      ? new Date(year + 1, 0, 1)
      : new Date(year, month, 1);

    const expenses = await prisma.operatingExpense.findMany({
      where: {
        owner_id: ownerId,
        expense_date: { gte: startDate, lt: endDate }
      },
      select: { amount: true }
    });

    return expenses.reduce((sum: number, item: any) => sum + Number(item.amount), 0);
  }
}

export const operatingExpenseRepository = new OperatingExpenseRepository();

export interface StockEntryInput {
  productId: string;
  weekday: number;
  in: number;
  jumla: number;
  uza: number;
  baki: number;
}

export class StockRepository {
  async getForWeek(ownerId: string, weekDate: Date) {
    return prisma.stockEntry.findMany({
      where: {
        owner_id: ownerId,
        week_date: weekDate,
      },
    });
  }

  async upsertAll(ownerId: string, weekDate: Date, entries: StockEntryInput[], productIds: string[]) {
    const weekStart = new Date(weekDate);
    weekStart.setHours(0, 0, 0, 0);

    // Remove saved entries for products no longer present (deleted this week)
    await prisma.stockEntry.deleteMany({
      where: {
        owner_id: ownerId,
        week_date: weekStart,
        product_id: { notIn: productIds.length ? productIds : ['__none__'] },
      },
    });

    for (const e of entries) {
      await prisma.stockEntry.upsert({
        where: {
          owner_id_product_id_week_date_weekday: {
            owner_id: ownerId,
            product_id: e.productId,
            week_date: weekStart,
            weekday: e.weekday,
          },
        },
        create: {
          owner_id: ownerId,
          product_id: e.productId,
          week_date: weekStart,
          weekday: e.weekday,
          in: e.in,
          jumla: e.jumla,
          uza: e.uza,
          baki: e.baki,
        },
        update: {
          in: e.in,
          jumla: e.jumla,
          uza: e.uza,
          baki: e.baki,
        },
      });
    }

    return true;
  }

  // Latest saved Baki (remaining stock) per product — from the most recent week
  // that has stock entries, taking the last recorded weekday for each product.
  async getLatestBaki(ownerId: string): Promise<Array<{ product_id: string; baki: number; week_date: Date; product: { name: string; category: string | null } }>> {
    const latest = await prisma.stockEntry.findFirst({
      where: { owner_id: ownerId },
      orderBy: { week_date: 'desc' },
      select: { week_date: true },
    });
    if (!latest) return [];

    const entries = await prisma.stockEntry.findMany({
      where: { owner_id: ownerId, week_date: latest.week_date },
      orderBy: [{ weekday: 'desc' }, { product_id: 'asc' }],
      include: { product: { select: { name: true, category: true } } },
    });

    const seen = new Set<string>();
    const result: Array<{ product_id: string; baki: number; week_date: Date; product: { name: string; category: string | null } }> = [];
    for (const e of entries) {
      if (seen.has(e.product_id)) continue;
      seen.add(e.product_id);
      result.push({ product_id: e.product_id, baki: e.baki, week_date: e.week_date, product: e.product });
    }
    return result;
  }
}

export const stockRepository = new StockRepository();
