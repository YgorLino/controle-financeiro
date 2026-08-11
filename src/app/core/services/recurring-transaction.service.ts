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

    const payload = {
      ...formData,
      recurrence_type: formData.recurrence_type ?? 'subscription',
      user_id: user.id
    };

    const { data, error } = await this.supabase.client
      .from('recurring_transactions')
      .insert(payload)
      .select(`*, category:categories!category_id(id, name, color)`)
      .single();
    if (error) throw error;

    this._recurring.update(r => [...r, data]);

    if (payload.recurrence_type === 'installment' && payload.installments) {
      const inserts = [];
      const [yearStr, monthStr] = payload.start_date.split('-');
      const startYear = Number(yearStr);
      const startMonth = Number(monthStr) - 1;

      for (let i = 0; i < payload.installments; i++) {
        const currentMonth = new Date(startYear, startMonth + i, 1);
        const refMonthStr = format(currentMonth, 'yyyy-MM-01');
        const safeDay = Math.min(payload.due_day, 28);
        const dueDate = setDate(currentMonth, safeDay);

        inserts.push({
          user_id: user.id,
          description: `${payload.description} (${i + 1}/${payload.installments})`,
          transaction_type: payload.transaction_type,
          amount: payload.amount,
          category_id: payload.category_id,
          reference_month: refMonthStr,
          due_date: format(dueDate, 'yyyy-MM-dd'),
          status: 'pending' as TransactionStatus,
          payment_date: null,
          notes: payload.notes,
          recurring_transaction_id: data.id
        });
      }

      if (inserts.length > 0) {
        await this.supabase.client.from('transactions').insert(inserts);
        this.transactionService.loadTransactions().catch(e => console.error(e));
      }
    }

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

    // Sincronizar transações filhas pendentes ou em atraso
    try {
      const { data: childTransactions } = await this.supabase.client
        .from('transactions')
        .select('id, reference_month')
        .eq('recurring_transaction_id', id)
        .in('status', ['pending', 'overdue']);

      if (childTransactions && childTransactions.length > 0) {
        const updates = childTransactions.map(tx => {
          let newDueDate = undefined;
          if (formData.due_day !== undefined) {
            const refDate = parseISO(tx.reference_month);
            const safeDay = Math.min(formData.due_day, 28);
            const dueDate = setDate(new Date(refDate.getFullYear(), refDate.getMonth(), 1), safeDay);
            newDueDate = format(dueDate, 'yyyy-MM-dd');
          }

          const txUpdate: any = {};
          if (formData.amount !== undefined) txUpdate.amount = formData.amount;
          if (formData.category_id !== undefined) txUpdate.category_id = formData.category_id;
          if (formData.transaction_type !== undefined) txUpdate.transaction_type = formData.transaction_type;
          if (formData.notes !== undefined) txUpdate.notes = formData.notes;
          if (newDueDate !== undefined) txUpdate.due_date = newDueDate;

          return this.supabase.client
            .from('transactions')
            .update(txUpdate)
            .eq('id', tx.id);
        });

        await Promise.all(updates);
        this.transactionService.loadTransactions().catch(e => console.error('Erro ao dar reload:', e));
      }
    } catch (e) {
      console.error('Erro ao sincronizar transações filhas:', e);
    }

    return data;
  }

  async delete(id: string, deleteFuture: boolean = false): Promise<void> {
    if (deleteFuture) {
      await this.supabase.client
        .from('transactions')
        .delete()
        .eq('recurring_transaction_id', id)
        .in('status', ['pending', 'overdue']);
    }

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
      if (r.recurrence_type === 'installment') return false;
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
