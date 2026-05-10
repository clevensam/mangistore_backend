export interface User {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  role: 'owner' | 'staff';
  status: 'active' | 'inactive';
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  buying_price: number;
  selling_price: number;
  quantity: number;
  low_stock_threshold: number;
  created_at?: string;
}

export interface Sale {
  id: string;
  product_id: string;
  quantity: number;
  total_price: number;
  created_at: string;
}

export interface AuthPayload {
  token: string;
  user: {
    id: string;
    email: string;
    displayName: string;
    role: string;
    status: string;
    createdAt: string;
  };
}