// src/app/core/services/auth.service.ts
import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { Profile } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);

  private readonly _session = signal<Session | null>(null);
  private readonly _profile = signal<Profile | null>(null);
  private readonly _loading = signal<boolean>(true);

  readonly session = this._session.asReadonly();
  readonly profile = this._profile.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly isAuthenticated = computed(() => !!this._session());
  readonly currentUser = computed(() => this._session()?.user ?? null);

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    const { data: { session } } = await this.supabase.client.auth.getSession();
    this._session.set(session);
    if (session?.user) await this.loadProfile(session.user.id);
    this._loading.set(false);

    this.supabase.client.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        this._session.set(session);
        if (session?.user) {
          await this.loadProfile(session.user.id);
        } else {
          this._profile.set(null);
        }
      }
    );
  }

  private async loadProfile(userId: string): Promise<void> {
    const { data } = await this.supabase.client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    this._profile.set(data);
  }

  async signUp(email: string, password: string, name: string) {
    const { data, error } = await this.supabase.client.auth.signUp({
      email,
      password,
      options: { data: { name } }
    });
    if (error) throw error;
    return data;
  }

  async signIn(email: string, password: string) {
    const { data, error } = await this.supabase.client.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return data;
  }

  async signOut(): Promise<void> {
    await this.supabase.client.auth.signOut();
    this._session.set(null);
    this._profile.set(null);
    this.router.navigate(['/auth/login']);
  }

  async resetPassword(email: string): Promise<void> {
    const { error } = await this.supabase.client.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/update-password`
    });
    if (error) throw error;
  }

  async updatePassword(newPassword: string): Promise<void> {
    const { error } = await this.supabase.client.auth.updateUser({
      password: newPassword
    });
    if (error) throw error;
  }

  async updateProfile(updates: Partial<Profile>): Promise<void> {
    const user = this.currentUser();
    if (!user) throw new Error('Usuário não autenticado');

    const { data, error } = await this.supabase.client
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select()
      .single();

    if (error) throw error;
    this._profile.set(data);
  }
}
