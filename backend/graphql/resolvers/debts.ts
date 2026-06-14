import { debtRepository, debtPaymentRepository } from '../../repositories/debtRepo';
import { requireAuth, getEffectiveOwnerId } from '../../auth/context';

export const debtResolvers = {
  Query: {
    debts: async (_: any, { type }: any, context: any) => {
      const user = requireAuth(context);
      const ownerId = await getEffectiveOwnerId(context);
      if (user.role === 'cashier') {
        type = 'receivable';
      }
      const debts = await debtRepository.getAll(ownerId, type);
      return debts.map((d: any) => ({
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
      const ownerId = await getEffectiveOwnerId(context);
      const d = await debtRepository.getById(id, ownerId);
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
      const ownerId = await getEffectiveOwnerId(context);
      const payments = await debtPaymentRepository.getByDebtId(debtId, ownerId);
      return payments.map((p: any) => ({
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
      const ownerId = await getEffectiveOwnerId(context);
      if (user.role === 'cashier' && type === 'payable') {
        throw new Error('Access denied');
      }
      const debt = await debtRepository.create({
        type,
        customer_id: customerId || undefined,
        supplier_name: supplierName || undefined,
        amount,
        due_date: dueDate,
        description,
        owner_id: ownerId
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
      const ownerId = await getEffectiveOwnerId(context);
      const debt = await debtRepository.getById(debtId, ownerId);
      if (!debt) throw new Error('Debt not found');
      if (user.role === 'cashier' && debt.type === 'payable') {
        throw new Error('Access denied');
      }

      await debtPaymentRepository.create(ownerId, {
        debt_id: debtId,
        amount,
        notes
      });

      const newAmountPaid = Number(debt.amount_paid) + amount;
      const remaining = Number(debt.amount) - newAmountPaid;
      const newStatus = remaining <= 0 ? 'paid' : 'partial';

      const updatedDebt = await debtRepository.updatePayment(debtId, ownerId, newAmountPaid, newStatus);

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
      const ownerId = await getEffectiveOwnerId(context);
      const debt = await debtRepository.getById(id, ownerId);
      if (!debt) throw new Error('Debt not found');
      if (user.role === 'cashier' && debt.type === 'payable') {
        throw new Error('Access denied');
      }

      const updatedDebt = await debtRepository.updatePayment(id, ownerId, Number(debt.amount), 'paid');

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