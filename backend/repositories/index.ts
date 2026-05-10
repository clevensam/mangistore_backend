import { supabase } from '../auth/context';

export interface ProductInput {
  name: string;
  category: string;
  buying_price: number;
  selling_price: number;
  quantity: number;
  low_stock_threshold: number;
}

export class ProductRepository {
  async getAll() {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name');
    if (error) throw error;
    return data;
  }

  async getById(id: string) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  }

  async create(input: ProductInput) {
    const { data, error } = await supabase
      .from('products')
      .insert([input])
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async update(id: string, updates: Partial<ProductInput>) {
    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async delete(id: string) {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  }

  async updateQuantity(id: string, quantity: number) {
    const product = await this.getById(id);
    if (product) {
      await this.update(id, { quantity: product.quantity + quantity });
    }
  }

  async decrementQuantity(id: string, quantity: number) {
    const { error } = await supabase.rpc('decrement_product_quantity', {
      product_id: id,
      decrement_amount: quantity
    });
    if (error) throw error;
    return true;
  }
}

export class SaleRepository {
  async getAll() {
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  async getByProductId(productId: string) {
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  async create(sale: { product_id: string; quantity: number; total_price: number }) {
    const { data, error } = await supabase
      .from('sales')
      .insert([sale])
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async recordSale(productId: string, quantity: number, totalPrice: number) {
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name, quantity')
      .eq('id', productId)
      .single();

    if (productError) {
      throw new Error('PRODUCT_NOT_FOUND');
    }

    if (product.quantity < quantity) {
      throw new Error(`INSUFFICIENT_STOCK:${product.quantity}`);
    }

    if (product.quantity === 0) {
      throw new Error('OUT_OF_STOCK');
    }

    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert([{
        product_id: productId,
        quantity,
        total_price: totalPrice
      }])
      .select()
      .single();

    if (saleError) {
      throw new Error('SALE_RECORD_FAILED');
    }

    const { error: updateError } = await supabase
      .from('products')
      .update({ quantity: product.quantity - quantity })
      .eq('id', productId);

    if (updateError) {
      throw new Error('STOCK_UPDATE_FAILED');
    }

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
}

export class OperatingExpenseRepository {
  async getAll() {
    const { data, error } = await supabase
      .from('operating_expenses')
      .select('*')
      .order('expense_date', { ascending: false });
    if (error) throw error;
    return data;
  }

  async getByCategory(category: string) {
    const { data, error } = await supabase
      .from('operating_expenses')
      .select('*')
      .eq('category', category)
      .order('expense_date', { ascending: false });
    if (error) throw error;
    return data;
  }

  async create(input: OperatingExpenseInput) {
    const { data, error } = await supabase
      .from('operating_expenses')
      .insert([{
        ...input,
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async update(id: string, updates: Partial<OperatingExpenseInput>) {
    const { data, error } = await supabase
      .from('operating_expenses')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async delete(id: string) {
    const { error } = await supabase
      .from('operating_expenses')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  }

  async getTotalByCategory() {
    const { data, error } = await supabase
      .from('operating_expenses')
      .select('category, amount');
    if (error) throw error;
    
    const totals: Record<string, number> = {};
    data?.forEach(item => {
      totals[item.category] = (totals[item.category] || 0) + Number(item.amount);
    });
    return totals;
  }

  async getMonthlyTotal(year: number, month: number) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = month === 12 
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`;

    const { data, error } = await supabase
      .from('operating_expenses')
      .select('amount')
      .gte('expense_date', startDate)
      .lt('expense_date', endDate);
    if (error) throw error;

    return data?.reduce((sum, item) => sum + Number(item.amount), 0) || 0;
  }
}

export const operatingExpenseRepository = new OperatingExpenseRepository();