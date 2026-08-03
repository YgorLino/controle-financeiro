// src/app/core/models/recurring-transaction.model.ts
import { TransactionType } from './transaction.model';
import { Category } from './category.model';

export type RecurringFrequency = 'monthly' | 'weekly' | 'yearly';

export interface RecurringTransaction {
  id: string;
  user_id: string;
  description: string;
  transaction_type: TransactionType;
  amount: number;
  category_id: string | null;
  start_date: string;
  end_date: string | null;
  due_day: number;
  frequency: RecurringFrequency;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Join
  category?: Category | null;
}

export interface RecurringFormData {
  description: string;
  transaction_type: TransactionType;
  amount: number;
  category_id: string | null;
  start_date: string;
  end_date: string | null;
  due_day: number;
  frequency: RecurringFrequency;
  notes: string | null;
}
