// src/app/core/models/transaction.model.ts
export type TransactionType = 'income' | 'expense';
export type TransactionStatus = 'paid' | 'pending' | 'overdue' | 'cancelled';

export interface Transaction {
  id: string;
  user_id: string;
  description: string;
  transaction_type: TransactionType;
  amount: number;
  category_id: string | null;
  reference_month: string; // ISO date: YYYY-MM-01
  due_date: string | null;
  status: TransactionStatus;
  payment_date: string | null;
  notes: string | null;
  recurring_transaction_id: string | null;
  account_id: string | null;
  created_at: string;
  updated_at: string;
  // Join
  category?: import('./category.model').Category | null;
  account?: import('./account.model').Account | null;
}

export interface TransactionFormData {
  description: string;
  transaction_type: TransactionType;
  amount: number;
  category_id: string | null;
  reference_month: string;
  due_date: string | null;
  status: TransactionStatus;
  payment_date: string | null;
  notes: string | null;
  account_id?: string | null;
  is_recurring: boolean;
}

export interface TransactionFilter {
  search?: string;
  category_id?: string;
  status?: TransactionStatus | '';
  transaction_type?: TransactionType | '';
}

export interface DashboardSummary {
  reference_month: string;
  total_income: number;
  total_expense: number;
  balance: number;
  total_paid: number;
  total_pending: number;
  pending_count: number;
  overdue_count: number;
  total_income_count: number;
  total_expense_count: number;
}
