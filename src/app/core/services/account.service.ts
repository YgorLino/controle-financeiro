// src/app/core/services/account.service.ts
import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { Account, AccountFormData } from '../models/account.model';

@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);

  private readonly _accounts = signal<Account[]>([]);
  private readonly _loading = signal<boolean>(false);

  readonly accounts = this._accounts.asReadonly();
  readonly loading = this._loading.asReadonly();

  async loadAccounts(): Promise<void> {
    this._loading.set(true);
    try {
      const { data, error } = await this.supabase.client
        .from('accounts')
        .select('*')
        .order('name');
      if (error) throw error;
      this._accounts.set(data ?? []);
    } finally {
      this._loading.set(false);
    }
  }

  async createAccount(formData: AccountFormData): Promise<Account> {
    const user = this.auth.currentUser();
    if (!user) throw new Error('Não autenticado');

    const payload = {
      ...formData,
      user_id: user.id,
      initial_balance: Number(formData.initial_balance)
    };

    const { data, error } = await this.supabase.client
      .from('accounts')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    this._accounts.update(accs => [...accs, data]);
    return data;
  }

  async updateAccount(id: string, updates: Partial<AccountFormData>): Promise<Account> {
    if (updates.initial_balance !== undefined) {
      updates.initial_balance = Number(updates.initial_balance);
    }

    const { data, error } = await this.supabase.client
      .from('accounts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    this._accounts.update(accs => accs.map(a => a.id === id ? data : a));
    return data;
  }

  async deleteAccount(id: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('accounts')
      .delete()
      .eq('id', id);

    if (error) throw error;
    this._accounts.update(accs => accs.filter(a => a.id !== id));
  }
}
