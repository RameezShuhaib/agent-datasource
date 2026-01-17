
export interface User {
  id: number;
  name: string;
  email: string;
  role: 'Admin' | 'User' | 'Editor' | 'Manager';
  created_at: string;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: 'Electronics' | 'Clothing' | 'Books' | 'Food';
}

export interface Order {
  id: number;
  user_id: number;
  product_id: number;
  quantity: number;
  total: number;
  status: 'Pending' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled';
  order_date: string;
}

// Fix: Export UserVariables type used in UserForm.tsx
export type UserVariables = any;
export type ResourceVariables = any;

declare global {
  interface Window {
    initSqlJs: any;
  }
}
