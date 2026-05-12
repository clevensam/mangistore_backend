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
    return prisma.product.update({
      where: { id },
      data: updates
    });
  }

  async delete(id: string, ownerId: string) {
    await prisma.product.delete({ where: { id } });
    return true;
  }

  async updateQuantity(id: string, ownerId: string, quantity: number) {
    const product = await this.getById(id, ownerId);
    if (product) {
      await this.update(id, ownerId, { quantity: product.quantity + quantity } as any);
    }
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

  async update(id: string, ownerId: string, updates: Partial<OperatingExpenseInput>) {
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
    await prisma.operatingExpense.delete({ where: { id } });
    return true;
  }

  async getTotalByCategory(ownerId: string) {
    const expenses = await prisma.operatingExpense.findMany({
      where: { owner_id: ownerId },
      select: { category: true, amount: true }
    });

    const totals: Record<string, number> = {};
    expenses.forEach(item => {
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

    return expenses.reduce((sum, item) => sum + Number(item.amount), 0);
  }
}

export const operatingExpenseRepository = new OperatingExpenseRepository();
