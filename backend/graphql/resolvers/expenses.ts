import { operatingExpenseRepository, OperatingExpenseInput } from '../../repositories';
import { requireAuth } from '../../auth/context';

export const expenseResolvers = {
  Query: {
    operatingExpenses: async (_: any, { category }: { category?: string }, context: any) => {
      const user = requireAuth(context);
      if (category) {
        return await operatingExpenseRepository.getByCategory(user.id, category);
      }
      return await operatingExpenseRepository.getAll(user.id);
    },

    operatingExpense: async (_: any, { id }: { id: string }, context: any) => {
      const user = requireAuth(context);
      const expenses = await operatingExpenseRepository.getAll(user.id);
      return expenses.find(e => e.id === id);
    },

    expenseTotalsByCategory: async (_: any, __: any, context: any) => {
      const user = requireAuth(context);
      const totals = await operatingExpenseRepository.getTotalByCategory(user.id);
      return Object.entries(totals).map(([category, total]) => ({
        category,
        total
      }));
    },

    monthlyExpenseTotal: async (_: any, { year, month }: { year: number; month: number }, context: any) => {
      const user = requireAuth(context);
      return await operatingExpenseRepository.getMonthlyTotal(user.id, year, month);
    }
  },

  Mutation: {
    createOperatingExpense: async (_: any, args: any, context: any) => {
      const user = requireAuth(context);
      const input: OperatingExpenseInput = {
        category: args.category,
        description: args.description || null,
        amount: args.amount,
        expense_date: args.expenseDate,
        status: args.status || 'paid',
        owner_id: user.id
      };
      return await operatingExpenseRepository.create(input);
    },

    updateOperatingExpense: async (_: any, args: any, context: any) => {
      const user = requireAuth(context);
      const updates: Partial<OperatingExpenseInput> = {};
      if (args.category) updates.category = args.category;
      if (args.description !== undefined) updates.description = args.description;
      if (args.amount) updates.amount = args.amount;
      if (args.expenseDate) updates.expense_date = args.expenseDate;
      if (args.status) updates.status = args.status;

      return await operatingExpenseRepository.update(args.id, user.id, updates);
    },

    deleteOperatingExpense: async (_: any, { id }: { id: string }, context: any) => {
      const user = requireAuth(context);
      return await operatingExpenseRepository.delete(id, user.id);
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