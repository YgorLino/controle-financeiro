// src/app/core/models/category.model.ts

export type CategoryTransactionType = 'income' | 'expense' | 'both';

export interface Category {
  id: string;
  user_id: string;
  name: string;
  color: string;
  transaction_type: CategoryTransactionType;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface CategoryFormData {
  name: string;
  color: string;
  transaction_type: CategoryTransactionType;
}
