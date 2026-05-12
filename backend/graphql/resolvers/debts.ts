import { debtRepository, debtPaymentRepository } from '../../repositories/debtRepo';
import { requireAuth } from '../../auth/context';

export const debtResolvers = {
  Query: {
    debts: async (_: any, { type }: any, context: any) => {
      const user = requireAuth(context);
      const debts = await debtRepository.getAll(user.id, type);
      return debts.map(d => ({
        id: d.id,
        type: d.type,
        customerId: d.customer_id || null,
        customer: d.customer ? {
          id: d.customer.id,
          name: d.customer.name,
          phone: d.customer.phone || '',
          email: d.customer.email || '',
          address: d.customer.address || '',
          status: d.customer.status,
          createdAt: d.customer.created_at
        } : null,
        supplierName: d.supplier_name || '',
        amount: Number(d.amount) || 0,
        amountPaid: Number(d.amount_paid) || 0,
        remaining: Number(d.amount) - Number(d.amount_paid),
        dueDate: d.due_date,
        status: d.status,
        description: d.description || '',
        createdAt: d.created_at,
        updatedAt: d.updated_at
      }));
    },
    debt: async (_: any, { id }: any, context: any) => {
      const user = requireAuth(context);
      const d = await debtRepository.getById(id, user.id);
      if (!d) return null;
      return {
        id: d.id,
        type: d.type,
        customerId: d.customer_id || null,
        customer: d.customer ? {
          id: d.customer.id,
          name: d.customer.name,
          phone: d.customer.phone || '',
          email: d.customer.email || '',
          address: d.customer.address || '',
          status: d.customer.status,
          createdAt: d.customer.created_at
        } : null,
        supplierName: d.supplier_name || '',
        amount: Number(d.amount) || 0,
        amountPaid: Number(d.amount_paid) || 0,
        remaining: Number(d.amount) - Number(d.amount_paid),
        dueDate: d.due_date,
        status: d.status,
        description: d.description || '',
        createdAt: d.created_at,
        updatedAt: d.updated_at
      };
    },
    debtPayments: async (_: any, { debtId }: any, context: any) => {
      const user = requireAuth(context);
      const payments = await debtPaymentRepository.getByDebtId(debtId, user.id);
      return payments.map(p => ({
        id: p.id,
        debtId: p.debt_id,
        amount: Number(p.amount) || 0,
        paymentDate: p.payment_date,
        notes: p.notes || ''
      }));
    }
  },
  Mutation: {
    createDebt: async (_: any, { type, customerId, supplierName, amount, dueDate, description }: any, context: any) => {
      const user = requireAuth(context);
      const debt = await debtRepository.create({
        type,
        customer_id: customerId || undefined,
        supplier_name: supplierName || undefined,
        amount,
        due_date: dueDate,
        description,
        owner_id: user.id
      });

      return {
        id: debt.id,
        type: debt.type,
        customerId: debt.customer_id || null,
        customer: null,
        supplierName: debt.supplier_name || '',
        amount: Number(debt.amount) || 0,
        amountPaid: 0,
        remaining: Number(debt.amount) || 0,
        dueDate: debt.due_date,
        status: debt.status,
        description: debt.description || '',
        createdAt: debt.created_at,
        updatedAt: debt.updated_at
      };
    },
    recordDebtPayment: async (_: any, { debtId, amount, notes }: any, context: any) => {
      const user = requireAuth(context);
      const debt = await debtRepository.getById(debtId, user.id);
      if (!debt) throw new Error('Debt not found');

      await debtPaymentRepository.create(user.id, {
        debt_id: debtId,
        amount,
        notes
      });

      const newAmountPaid = Number(debt.amount_paid) + amount;
      const remaining = Number(debt.amount) - newAmountPaid;
      const newStatus = remaining <= 0 ? 'paid' : 'partial';

      const updatedDebt = await debtRepository.updatePayment(debtId, user.id, newAmountPaid, newStatus);

      return {
        id: updatedDebt.id,
        type: updatedDebt.type,
        customerId: updatedDebt.customer_id || null,
        customer: updatedDebt.customer ? {
          id: updatedDebt.customer.id,
          name: updatedDebt.customer.name,
          phone: updatedDebt.customer.phone || '',
          email: updatedDebt.customer.email || '',
          address: updatedDebt.customer.address || '',
          status: updatedDebt.customer.status,
          createdAt: updatedDebt.customer.created_at
        } : null,
        supplierName: updatedDebt.supplier_name || '',
        amount: Number(updatedDebt.amount) || 0,
        amountPaid: newAmountPaid,
        remaining: remaining > 0 ? remaining : 0,
        dueDate: updatedDebt.due_date,
        status: newStatus,
        description: updatedDebt.description || '',
        createdAt: updatedDebt.created_at,
        updatedAt: updatedDebt.updated_at
      };
    },
    markDebtAsPaid: async (_: any, { id }: any, context: any) => {
      const user = requireAuth(context);
      const debt = await debtRepository.getById(id, user.id);
      if (!debt) throw new Error('Debt not found');

      const updatedDebt = await debtRepository.updatePayment(id, user.id, Number(debt.amount), 'paid');

      return {
        id: updatedDebt.id,
        type: updatedDebt.type,
        customerId: updatedDebt.customer_id || null,
        customer: updatedDebt.customer ? {
          id: updatedDebt.customer.id,
          name: updatedDebt.customer.name,
          phone: updatedDebt.customer.phone || '',
          email: updatedDebt.customer.email || '',
          address: updatedDebt.customer.address || '',
          status: updatedDebt.customer.status,
          createdAt: updatedDebt.customer.created_at
        } : null,
        supplierName: updatedDebt.supplier_name || '',
        amount: Number(updatedDebt.amount) || 0,
        amountPaid: Number(updatedDebt.amount) || 0,
        remaining: 0,
        dueDate: updatedDebt.due_date,
        status: 'paid',
        description: updatedDebt.description || '',
        createdAt: updatedDebt.created_at,
        updatedAt: updatedDebt.updated_at
      };
    }
  }
};