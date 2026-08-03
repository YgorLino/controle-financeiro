// src/app/core/services/recurring-transaction.service.ts
import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { RecurringTransaction, RecurringFormData } from '../models/recurring-transaction.model';
import { TransactionService } from './transaction.service';
import { TransactionStatus } from '../models/transaction.model';
import { format, parseISO, isAfter, isBefore, startOfMonth, setDate } from 'date-fns';

@Injectable({ providedIn: 'root' })
export class RecurringTransactionService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);
  private readonly transactionService = inject(TransactionService);

  private readonly _recurring = signal<RecurringTransaction[]>([]);
  private readonly _loading = signal<boolean>(false);

  readonly recurring = this._recurring.asReadonly();
  readonly loading = this._loading.asReadonly();

  async loadRecurring(): Promise<void> {
    this._loading.set(true);
    try {
      const { data, error } = await this.supabase.client
        .from('recurring_transactions')
        .select(`*, category:categories!category_id(id, name, color)`)
        .order('description');
      if (error) throw error;
      this._recurring.set(data ?? []);
    } finally {
      this._loading.set(false);
    }
  }

  async create(formData: RecurringFormData): Promise<RecurringTransaction> {
    const user = this.auth.currentUser();
    if (!user) throw new Error('Não autenticado');

    const { data, error } = await this.supabase.client
      .from('recurring_transactions')
      .insert({ ...formData, user_id: user.id })
      .select(`*, category:categories!category_id(id, name, color)`)
      .single();
    if (error) throw error;

    this._recurring.update(r => [...r, data]);
    return data;
  }

  async update(id: string, formData: Partial<RecurringFormData>): Promise<RecurringTransaction> {
    const { data, error } = await this.supabase.client
      .from('recurring_transactions')
      .update(formData)
      .eq('id', id)
      .select(`*, category:categories!category_id(id, name, color)`)
      .single();
    if (error) throw error;

    this._recurring.update(r => r.map(x => x.id === id ? data : x));
    return data;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('recurring_transactions')
      .delete()
      .eq('id', id);
    if (error) throw error;
    this._recurring.update(r => r.filter(x => x.id !== id));
  }

  async toggleActive(id: string, isActive: boolean): Promise<void> {
    await this.update(id, { } as Partial<RecurringFormData>);
    const { error } = await this.supabase.client
      .from('recurring_transactions')
      .update({ is_active: isActive })
      .eq('id', id);
    if (error) throw error;
    this._recurring.update(r => r.map(x => x.id === id ? { ...x, is_active: isActive } : x));
  }

  /**
   * Gera lançamentos para o mês alvo a partir das recorrências ativas.
   * Não duplica registros já existentes.
   */
  async generateForMonth(targetMonth: string): Promise<number> {
    const user = this.auth.currentUser();
    if (!user) throw new Error('Não autenticado');

    const targetDate = parseISO(targetMonth);

    const activeRecurring = this._recurring().filter(r => {
      if (!r.is_active) return false;
      const start = startOfMonth(parseISO(r.start_date));
      if (isAfter(start, targetDate)) return false;
      if (r.end_date && isBefore(parseISO(r.end_date), targetDate)) return false;
      return true;
    });

    if (activeRecurring.length === 0) return 0;

    // Verificar quais já existem neste mês
    const recurringIds = activeRecurring.map(r => r.id);
    const { data: existing } = await this.supabase.client
      .from('transactions')
      .select('recurring_transaction_id')
      .eq('reference_month', targetMonth)
      .in('recurring_transaction_id', recurringIds);

    const existingIds = new Set((existing ?? []).map((e: any) => e.recurring_transaction_id));
    const toCreate = activeRecurring.filter(r => !existingIds.has(r.id));

    if (toCreate.length === 0) return 0;

    const inserts = toCreate.map(r => {
      // Dia de vencimento (limitado a 28 para evitar problemas em fevereiro)
      const safeDay = Math.min(r.due_day, 28);
      const dueDate = setDate(new Date(targetDate.getFullYear(), targetDate.getMonth(), 1), safeDay);

      return {
        user_id: user.id,
        description: r.description,
        transaction_type: r.transaction_type,
        amount: r.amount,
        category_id: r.category_id,
        reference_month: targetMonth,
        due_date: format(dueDate, 'yyyy-MM-dd'),
        status: 'pending' as TransactionStatus,
        payment_date: null,
        notes: r.notes,
        recurring_transaction_id: r.id
      };
    });

    const { error } = await this.supabase.client
      .from('transactions')
      .insert(inserts);
    if (error) throw error;

    // Recarregar transações para atualizar o estado
    await this.transactionService.loadTransactions(targetMonth);
    return toCreate.length;
  }
}
