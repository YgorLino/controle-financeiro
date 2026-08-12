import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injectable,
  signal
} from '@angular/core';
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
  private readonly destroyRef = inject(DestroyRef);

  private readonly _accessStatus = signal<AccessStatus | null>(null);
  private readonly _loading = signal(true);
  private readonly _clock = signal(Date.now());
  private readonly _statusFetchedAt = signal(Date.now());

  private initializedUserId: string | null = null;
  private initializingUserId: string | null = null;
  private initializationPromise: Promise<void> | null = null;

  readonly accessStatus = this._accessStatus.asReadonly();
  readonly loading = this._loading.asReadonly();

  readonly remainingTimeMs = computed(() => {
    const status = this._accessStatus();
    const now = this._clock();
    const fetchedAt = this._statusFetchedAt();

    if (!status || status.access_kind === 'expired') return 0;
    return Math.max(0, status.time_remaining_ms - Math.max(0, now - fetchedAt));
  });

  readonly hasValidAccess = computed(() => {
    const kind = this._accessStatus()?.access_kind;
    return (kind === 'trial' || kind === 'paid') && this.remainingTimeMs() > 0;
  });

  readonly isTrial = computed(() =>
    this._accessStatus()?.access_kind === 'trial' && this.remainingTimeMs() > 0
  );
  readonly isPaid = computed(() =>
    this._accessStatus()?.access_kind === 'paid' && this.remainingTimeMs() > 0
  );
  readonly isExpired = computed(() =>
    this._accessStatus() !== null && !this.hasValidAccess()
  );

  constructor() {
    const clockInterval = window.setInterval(() => this._clock.set(Date.now()), 15_000);
    this.destroyRef.onDestroy(() => window.clearInterval(clockInterval));

    effect(() => {
      const authIsLoading = this.auth.loading();
      const userId = this.auth.currentUser()?.id ?? null;

      if (authIsLoading) {
        this._loading.set(true);
        return;
      }

      if (!userId) {
        this.reset();
        return;
      }

      if (this.initializedUserId !== userId && this.initializingUserId !== userId) {
        void this.ensureInitialized();
      }
    });
  }

  async ensureInitialized(): Promise<void> {
    const userId = this.auth.currentUser()?.id;
    if (!userId) {
      this.reset();
      return;
    }

    if (this.initializedUserId === userId && this._accessStatus()) return;

    if (this.initializationPromise) {
      await this.initializationPromise;
      if (this.initializedUserId !== userId) {
        return this.ensureInitialized();
      }
      return;
    }

    this.initializingUserId = userId;
    this.initializationPromise = this.initializeAccess(userId);

    try {
      await this.initializationPromise;
    } finally {
      this.initializationPromise = null;
      this.initializingUserId = null;
    }
  }

  async refreshAccessStatus(): Promise<void> {
    const userId = this.auth.currentUser()?.id;
    if (!userId) {
      this.reset();
      return;
    }

    this._loading.set(true);
    try {
      await this.fetchAccessStatus(userId);
      if (this.auth.currentUser()?.id === userId) {
        this.initializedUserId = userId;
      }
    } finally {
      if (this.auth.currentUser()?.id === userId) {
        this._loading.set(false);
      }
    }
  }

  async startFreeTrialIfEligible(): Promise<void> {
    await this.ensureInitialized();
  }

  private async initializeAccess(userId: string): Promise<void> {
    this._loading.set(true);

    try {
      const { error } = await this.supabase.client.rpc('start_free_trial');
      if (error) {
        console.error('Failed to start trial:', error);
      }

      await this.fetchAccessStatus(userId);
      if (this.auth.currentUser()?.id === userId) {
        this.initializedUserId = userId;
      }
    } finally {
      if (this.auth.currentUser()?.id === userId) {
        this._loading.set(false);
      }
    }
  }

  private async fetchAccessStatus(userId: string): Promise<void> {
    try {
      const { data, error } = await this.supabase.client.rpc('get_access_status');
      if (error) throw error;

      const rawStatus = Array.isArray(data) ? data[0] : data;
      if (!rawStatus || !['trial', 'paid', 'expired'].includes(rawStatus.access_kind)) {
        throw new Error('Status de acesso inválido');
      }

      if (this.auth.currentUser()?.id !== userId) return;

      const fetchedAt = Date.now();
      this._statusFetchedAt.set(fetchedAt);
      this._clock.set(fetchedAt);
      this._accessStatus.set({
        access_kind: rawStatus.access_kind,
        server_now: rawStatus.server_now,
        trial_ends_at: rawStatus.trial_ends_at,
        subscription_expires_at: rawStatus.subscription_expires_at,
        time_remaining_ms: Number(rawStatus.time_remaining_ms) || 0
      });
    } catch (error) {
      console.error('Error fetching access status:', error);
      if (this.auth.currentUser()?.id !== userId) return;

      const fetchedAt = Date.now();
      this._statusFetchedAt.set(fetchedAt);
      this._clock.set(fetchedAt);
      this._accessStatus.set({
        access_kind: 'expired',
        server_now: new Date(fetchedAt).toISOString(),
        trial_ends_at: null,
        subscription_expires_at: null,
        time_remaining_ms: 0
      });
    }
  }

  private reset(): void {
    this.initializedUserId = null;
    this._accessStatus.set(null);
    this._loading.set(false);
  }
}
