import { Injectable, inject, signal, computed } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';

export interface AccessStatus {
  access_kind: 'trial' | 'paid' | 'expired';
  server_now: string;
  trial_ends_at: string | null;
  subscription_expires_at: string | null;
  time_remaining_ms: number;
}

@Injectable({ providedIn: 'root' })
export class AccessService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);

  private readonly _accessStatus = signal<AccessStatus | null>(null);
  private readonly _loading = signal<boolean>(true);

  constructor() {
    import('@angular/core').then(core => {
      core.effect(() => {
        if (this.auth.isAuthenticated()) {
          this.startFreeTrialIfEligible();
        } else {
          this._accessStatus.set(null);
        }
      });
    });
  }

  readonly accessStatus = this._accessStatus.asReadonly();
  readonly loading = this._loading.asReadonly();

  readonly hasValidAccess = computed(() => {
    const status = this._accessStatus();
    if (!status) return false;
    return status.access_kind === 'trial' || status.access_kind === 'paid';
  });

  readonly isTrial = computed(() => this._accessStatus()?.access_kind === 'trial');
  readonly isPaid = computed(() => this._accessStatus()?.access_kind === 'paid');
  readonly isExpired = computed(() => this._accessStatus()?.access_kind === 'expired');

  async refreshAccessStatus(): Promise<void> {
    if (!this.auth.isAuthenticated()) {
      this._accessStatus.set(null);
      this._loading.set(false);
      return;
    }

    try {
      this._loading.set(true);
      const { data, error } = await this.supabase.client.rpc('get_access_status');
      
      if (error) {
        console.error('Error fetching access status:', error);
        throw error;
      }

      this._accessStatus.set(data as AccessStatus);
    } catch (e) {
      console.error(e);
      // Fallback
      this._accessStatus.set({
        access_kind: 'expired',
        server_now: new Date().toISOString(),
        trial_ends_at: null,
        subscription_expires_at: null,
        time_remaining_ms: 0
      });
    } finally {
      this._loading.set(false);
    }
  }

  async startFreeTrialIfEligible(): Promise<void> {
    if (!this.auth.isAuthenticated()) return;

    try {
      const { error } = await this.supabase.client.rpc('start_free_trial');
      if (error) {
        console.error('Failed to start trial:', error);
      } else {
        await this.refreshAccessStatus();
      }
    } catch (e) {
      console.error(e);
    }
  }
}
