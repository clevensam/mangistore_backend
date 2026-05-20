import { operatingExpenseRepository, OperatingExpenseInput } from '../../repositories';
import { requireRole, getEffectiveOwnerId } from '../../auth/context';

export const expenseResolvers = {
  Query: {
    operatingExpenses: async (_: any, { category }: { category?: string }, context: any) => {
      const user = requireRole(context, 'owner', 'manager');
      const ownerId = await getEffectiveOwnerId(context);
      if (category) {
        return await operatingExpenseRepository.getByCategory(ownerId, category);
      }
      return await operatingExpenseRepository.getAll(ownerId);
    },

    operatingExpense: async (_: any, { id }: { id: string }, context: any) => {
      const user = requireRole(context, 'owner', 'manager');
      const ownerId = await getEffectiveOwnerId(context);
      const expenses = await operatingExpenseRepository.getAll(ownerId);
      return expenses.find(e => e.id === id);
    },

    expenseTotalsByCategory: async (_: any, __: any, context: any) => {
      const user = requireRole(context, 'owner', 'manager');
      const ownerId = await getEffectiveOwnerId(context);
      const totals = await operatingExpenseRepository.getTotalByCategory(ownerId);
      return Object.entries(totals).map(([category, total]) => ({
        category,
        total
      }));
    },

    monthlyExpenseTotal: async (_: any, { year, month }: { year: number; month: number }, context: any) => {
      const user = requireRole(context, 'owner', 'manager');
      const ownerId = await getEffectiveOwnerId(context);
      return await operatingExpenseRepository.getMonthlyTotal(ownerId, year, month);
    }
  },

  Mutation: {
    createOperatingExpense: async (_: any, args: any, context: any) => {
      const user = requireRole(context, 'owner', 'manager');
      const ownerId = await getEffectiveOwnerId(context);
      const input: OperatingExpenseInput = {
        category: args.category,
        description: args.description || null,
        amount: args.amount,
        expense_date: args.expenseDate,
        status: args.status || 'paid',
        owner_id: ownerId
      };
      return await operatingExpenseRepository.create(input);
    },

    updateOperatingExpense: async (_: any, args: any, context: any) => {
      const user = requireRole(context, 'owner', 'manager');
      const ownerId = await getEffectiveOwnerId(context);
      const updates: Partial<OperatingExpenseInput> = {};
      if (args.category) updates.category = args.category;
      if (args.description !== undefined) updates.description = args.description;
      if (args.amount) updates.amount = args.amount;
      if (args.expenseDate) updates.expense_date = args.expenseDate;
      if (args.status) updates.status = args.status;

      return await operatingExpenseRepository.update(args.id, ownerId, updates);
    },

    deleteOperatingExpense: async (_: any, { id }: { id: string }, context: any) => {
      const user = requireRole(context, 'owner', 'manager');
      const ownerId = await getEffectiveOwnerId(context);
      return await operatingExpenseRepository.delete(id, ownerId);
    }
  },

  OperatingExpense: {
    id: (parent: any) => parent.id,
    category: (parent: any) => parent.category,
    description: (parent: any) => parent.description,
    amount: (parent: any) => parseFloat(parent.amount),
    expenseDate: (parent: any) => parent.expense_date,
    status: (parent: any) => parent.status,
    createdAt: (parent: any) => parent.created_at,
    updatedAt: (parent: any) => parent.updated_at
  },

  ExpenseCategoryTotal: {
    category: (parent: any) => parent.category,
    total: (parent: any) => parseFloat(parent.total)
  }
};