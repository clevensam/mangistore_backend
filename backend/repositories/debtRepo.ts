import { supabase } from '../auth/context';

export interface DebtInput {
  type: 'payable' | 'receivable';
  customer_id?: string;
  supplier_name?: string;
  amount: number;
  due_date: string;
  description?: string;
}

export class DebtRepository {
  async getAll(type?: string) {
    let query = supabase
      .from('debts')
      .select('*, customer:customers(*)')
      .order('due_date', { ascending: true });

    if (type) {
      query = query.eq('type', type);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async getById(id: string) {
    const { data, error } = await supabase
      .from('debts')
      .select('*, customer:customers(*)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  }

  async create(input: DebtInput) {
    const { data, error } = await supabase
      .from('debts')
      .insert([{
        ...input,
        amount_paid: 0,
        status: 'pending'
      }])
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async updatePayment(debtId: string, amountPaid: number, newStatus: 'partial' | 'paid') {
    const { data, error } = await supabase
      .from('debts')
      .update({
        amount_paid: amountPaid,
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', debtId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async delete(id: string) {
    const { error } = await supabase
      .from('debts')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  }
}

export class DebtPaymentRepository {
  async getByDebtId(debtId: string) {
    const { data, error } = await supabase
      .from('debt_payments')
      .select('*')
      .eq('debt_id', debtId)
      .order('payment_date', { ascending: false });
    if (error) throw error;
    return data;
  }

  async create(payment: { debt_id: string; amount: number; notes?: string }) {
    const { data, error } = await supabase
      .from('debt_payments')
      .insert([payment])
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

export const debtRepository = new DebtRepository();
export const debtPaymentRepository = new DebtPaymentRepository();