import { supabase } from '../auth/context';

export interface CustomerInput {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
}

export class CustomerRepository {
  async getAll() {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('name');
    if (error) throw error;
    return data;
  }

  async getById(id: string) {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  }

  async create(input: CustomerInput) {
    const { data, error } = await supabase
      .from('customers')
      .insert([{ ...input, status: 'active' }])
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async update(id: string, updates: Partial<CustomerInput & { status: string }>) {
    const { data, error } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async delete(id: string) {
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  }
}

export const customerRepository = new CustomerRepository();