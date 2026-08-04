// src/app/core/services/transaction.service.ts
import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import {
  Transaction,
  TransactionFormData,
  DashboardSummary,
  TransactionStatus
} from '../models/transaction.model';
import { format, startOfMonth, parseISO } from 'date-fns';

@Injectable({ providedIn: 'root' })
export class TransactionService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);

  private readonly _transactions = signal<Transaction[]>([]);
  private readonly _loading = signal<boolean>(false);
  private readonly _currentMonth = signal<Date>(startOfMonth(new Date()));

  readonly transactions = this._transactions.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly currentMonth = this._currentMonth.asReadonly();

  setCurrentMonth(date: Date): void {
    this._currentMonth.set(startOfMonth(date));
  }

  getReferenceMonthString(date?: Date): string {
    return format(date ?? this._currentMonth(), 'yyyy-MM-01');
  }

  async loadTransactions(referenceMonth?: string): Promise<void> {
    this._loading.set(true);
    try {
      const month = referenceMonth ?? this.getReferenceMonthString();
      const { data, error } = await this.supabase.client
        .from('transactions')
        .select(`
          *,
          category:categories!category_id(id, name, color, transaction_type),
          account:accounts!account_id(id, name, color)
        `)
        .eq('reference_month', month)
        .order('created_at', { ascending: false });
      if (error) throw error;
      this._transactions.set(data ?? []);
    } finally {
      this._loading.set(false);
    }
  }

  async createTransaction(formData: TransactionFormData): Promise<Transaction> {
    const user = this.auth.currentUser();
    if (!user) throw new Error('Não autenticado');

    const { is_recurring, ...payload } = formData;

    const { data, error } = await this.supabase.client
      .from('transactions')
      .insert({ ...payload, user_id: user.id, amount: Number(formData.amount), account_id: formData.account_id || null })
      .select(`*, category:categories!category_id(id, name, color, transaction_type), account:accounts!account_id(id, name, color)`)
      .single();
    if (error) throw error;

    this._transactions.update(txns => [data, ...txns]);
    return data;
  }

  async updateTransaction(
    id: string,
    updates: Partial<TransactionFormData>
  ): Promise<Transaction> {
    const { is_recurring, ...payload } = updates as TransactionFormData;
    if ((payload as any).amount !== undefined) {
      (payload as any).amount = Number((payload as any).amount);
    }

    const { data, error } = await this.supabase.client
      .from('transactions')
      .update({ ...payload, account_id: payload.account_id || null })
      .eq('id', id)
      .select(`*, category:categories!category_id(id, name, color, transaction_type), account:accounts!account_id(id, name, color)`)
      .single();
    if (error) throw error;

    this._transactions.update(txns => txns.map(t => t.id === id ? data : t));
    return data;
  }

  async deleteTransaction(id: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('transactions')
      .delete()
      .eq('id', id);
    if (error) throw error;
    this._transactions.update(txns => txns.filter(t => t.id !== id));
  }

  async updateStatus(
    id: string,
    status: TransactionStatus,
    paymentDate?: string | null
  ): Promise<void> {
    const updates: Record<string, unknown> = { status };
    if (status === 'paid') {
      updates['payment_date'] = paymentDate ?? format(new Date(), 'yyyy-MM-dd');
    } else if (status === 'pending' || status === 'overdue' || status === 'cancelled') {
      updates['payment_date'] = null;
    }
    await this.updateTransaction(id, updates as Partial<TransactionFormData>);
  }

  async duplicateTransaction(transaction: Transaction): Promise<Transaction> {
    const formData: TransactionFormData = {
      description: `${transaction.description} (cópia)`,
      transaction_type: transaction.transaction_type,
      amount: transaction.amount,
      category_id: transaction.category_id,
      reference_month: transaction.reference_month,
      due_date: transaction.due_date,
      status: 'pending',
      payment_date: null,
      notes: transaction.notes,
      account_id: transaction.account_id,
      is_recurring: false
    };
    return this.createTransaction(formData);
  }

  async getDashboardSummary(referenceMonth: string): Promise<DashboardSummary> {
    const user = this.auth.currentUser();
    
    if (!user) {
      return {
        reference_month: referenceMonth,
        total_income: 0,
        total_expense: 0,
        balance: 0,
        total_paid: 0,
        total_pending: 0,
        pending_count: 0,
        overdue_count: 0,
        total_income_count: 0,
        total_expense_count: 0
      };
    }

    const { data, error } = await this.supabase.client
      .from('dashboard_summary')
      .select('*')
      .eq('reference_month', referenceMonth)
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      return {
        reference_month: referenceMonth,
        total_income: 0,
        total_expense: 0,
        balance: 0,
        total_paid: 0,
        total_pending: 0,
        pending_count: 0,
        overdue_count: 0,
        total_income_count: 0,
        total_expense_count: 0
      };
    }

    return {
      ...data,
      total_income: Number(data.total_income),
      total_expense: Number(data.total_expense),
      balance: Number(data.balance),
      total_paid: Number(data.total_paid),
      total_pending: Number(data.total_pending)
    };
  }

  async copyPreviousMonth(targetMonth: string): Promise<Transaction[]> {
    const targetDate = parseISO(targetMonth);
    const prevMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() - 1, 1);
    const prevMonthStr = format(prevMonth, 'yyyy-MM-01');

    const { data: prevTransactions, error } = await this.supabase.client
      .from('transactions')
      .select('*')
      .eq('reference_month', prevMonthStr);

    if (error) throw error;
    if (!prevTransactions || prevTransactions.length === 0) return [];

    const user = this.auth.currentUser();
    if (!user) throw new Error('Não autenticado');

    const newTransactions = prevTransactions.map((t: Transaction) => ({
      description: t.description,
      transaction_type: t.transaction_type,
      amount: t.amount,
      category_id: t.category_id,
      reference_month: targetMonth,
      due_date: null,
      status: 'pending' as TransactionStatus,
      payment_date: null,
      notes: t.notes,
      recurring_transaction_id: t.recurring_transaction_id,
      account_id: t.account_id,
      user_id: user.id
    }));

    const { data: created, error: insertError } = await this.supabase.client
      .from('transactions')
      .insert(newTransactions)
      .select(`*, category:categories!category_id(id, name, color, transaction_type)`);

    if (insertError) throw insertError;
    this._transactions.update(txns => [...(created ?? []), ...txns]);
    return created ?? [];
  }
}
