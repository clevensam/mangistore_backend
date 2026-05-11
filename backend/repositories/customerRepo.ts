import { supabase } from '../auth/context';

export interface CustomerInput {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  owner_id: string;
}

export class CustomerRepository {
  async getAll(ownerId: string) {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('owner_id', ownerId)
      .order('name');
    if (error) throw error;
    return data;
  }

  async getById(id: string, ownerId: string) {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .eq('owner_id', ownerId)
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

  async update(id: string, ownerId: string, updates: Partial<CustomerInput & { status: string }>) {
    const { data, error } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', id)
      .eq('owner_id', ownerId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async delete(id: string, ownerId: string) {
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id)
      .eq('owner_id', ownerId);
    if (error) throw error;
    return true;
  }
}

export const customerRepository = new CustomerRepository();