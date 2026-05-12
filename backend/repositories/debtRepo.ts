import prisma from '../prisma';

export interface DebtInput {
  type: 'payable' | 'receivable';
  customer_id?: string;
  supplier_name?: string;
  amount: number;
  due_date: string;
  description?: string;
  owner_id: string;
}

export class DebtRepository {
  async getAll(ownerId: string, type?: string) {
    const where: any = { owner_id: ownerId };
    if (type) {
      where.type = type;
    }

    return prisma.debt.findMany({
      where,
      include: { customer: true },
      orderBy: { due_date: 'asc' }
    });
  }

  async getById(id: string, ownerId: string) {
    return prisma.debt.findFirst({
      where: { id, owner_id: ownerId },
      include: { customer: true }
    });
  }

  async create(input: DebtInput) {
    return prisma.debt.create({
      data: {
        type: input.type,
        customer_id: input.customer_id || null,
        supplier_name: input.supplier_name || null,
        amount: input.amount,
        amount_paid: 0,
        due_date: new Date(input.due_date),
        description: input.description || null,
        status: 'pending',
        owner_id: input.owner_id
      }
    });
  }

  async updatePayment(debtId: string, ownerId: string, amountPaid: number, newStatus: 'partial' | 'paid') {
    return prisma.debt.update({
      where: { id: debtId },
      data: {
        amount_paid: amountPaid,
        status: newStatus
      },
      include: { customer: true }
    });
  }

  async delete(id: string, ownerId: string) {
    await prisma.debt.delete({ where: { id } });
    return true;
  }
}

export class DebtPaymentRepository {
  async getByDebtId(debtId: string, ownerId: string) {
    return prisma.debtPayment.findMany({
      where: { debt_id: debtId, owner_id: ownerId },
      orderBy: { payment_date: 'desc' }
    });
  }

  async create(ownerId: string, payment: { debt_id: string; amount: number; notes?: string }) {
    return prisma.debtPayment.create({
      data: {
        debt_id: payment.debt_id,
        amount: payment.amount,
        notes: payment.notes || null,
        owner_id: ownerId
      }
    });
  }
}

export const debtRepository = new DebtRepository();
export const debtPaymentRepository = new DebtPaymentRepository();
