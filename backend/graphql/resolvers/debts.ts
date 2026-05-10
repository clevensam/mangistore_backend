import { debtRepository, debtPaymentRepository } from '../../repositories/debtRepo';

export const debtResolvers = {
  Query: {
    debts: async (_: any, { type }: any) => {
      const debts = await debtRepository.getAll(type);
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
        amount: parseFloat(d.amount) || 0,
        amountPaid: parseFloat(d.amount_paid) || 0,
        remaining: parseFloat(d.amount) - parseFloat(d.amount_paid),
        dueDate: d.due_date,
        status: d.status,
        description: d.description || '',
        createdAt: d.created_at,
        updatedAt: d.updated_at
      }));
    },
    debt: async (_: any, { id }: any) => {
      const d = await debtRepository.getById(id);
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
        amount: parseFloat(d.amount) || 0,
        amountPaid: parseFloat(d.amount_paid) || 0,
        remaining: parseFloat(d.amount) - parseFloat(d.amount_paid),
        dueDate: d.due_date,
        status: d.status,
        description: d.description || '',
        createdAt: d.created_at,
        updatedAt: d.updated_at
      };
    },
    debtPayments: async (_: any, { debtId }: any) => {
      const payments = await debtPaymentRepository.getByDebtId(debtId);
      return payments.map(p => ({
        id: p.id,
        debtId: p.debt_id,
        amount: parseFloat(p.amount) || 0,
        paymentDate: p.payment_date,
        notes: p.notes || ''
      }));
    }
  },
  Mutation: {
    createDebt: async (_: any, { type, customerId, supplierName, amount, dueDate, description }: any) => {
      const debt = await debtRepository.create({
        type,
        customer_id: customerId || undefined,
        supplier_name: supplierName || undefined,
        amount,
        due_date: dueDate,
        description
      });

      return {
        id: debt.id,
        type: debt.type,
        customerId: debt.customer_id || null,
        customer: null,
        supplierName: debt.supplier_name || '',
        amount: parseFloat(debt.amount) || 0,
        amountPaid: 0,
        remaining: parseFloat(debt.amount) || 0,
        dueDate: debt.due_date,
        status: debt.status,
        description: debt.description || '',
        createdAt: debt.created_at,
        updatedAt: debt.updated_at
      };
    },
    recordDebtPayment: async (_: any, { debtId, amount, notes }: any) => {
      const debt = await debtRepository.getById(debtId);
      if (!debt) throw new Error('Debt not found');

      await debtPaymentRepository.create({
        debt_id: debtId,
        amount,
        notes
      });

      const newAmountPaid = parseFloat(debt.amount_paid) + amount;
      const remaining = parseFloat(debt.amount) - newAmountPaid;
      const newStatus = remaining <= 0 ? 'paid' : 'partial';

      const updatedDebt = await debtRepository.updatePayment(debtId, newAmountPaid, newStatus);

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
        amount: parseFloat(updatedDebt.amount) || 0,
        amountPaid: newAmountPaid,
        remaining: remaining > 0 ? remaining : 0,
        dueDate: updatedDebt.due_date,
        status: newStatus,
        description: updatedDebt.description || '',
        createdAt: updatedDebt.created_at,
        updatedAt: updatedDebt.updated_at
      };
    },
    markDebtAsPaid: async (_: any, { id }: any) => {
      const debt = await debtRepository.getById(id);
      if (!debt) throw new Error('Debt not found');

      const updatedDebt = await debtRepository.updatePayment(id, parseFloat(debt.amount), 'paid');

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
        amount: parseFloat(updatedDebt.amount) || 0,
        amountPaid: parseFloat(updatedDebt.amount) || 0,
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