import { Component, ChangeDetectionStrategy, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { SubscriptionService, PixPaymentResponse } from '../../../../core/services/subscription.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { AuthService } from '../../../../core/services/auth.service';
import { AccessService } from '../../../../core/services/access.service';

@Component({
  selector: 'app-subscription',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './subscription.component.html',
  styleUrl: './subscription.component.scss'
})
export class SubscriptionComponent implements OnDestroy {
  private readonly subService = inject(SubscriptionService);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  public readonly accessService = inject(AccessService);

  readonly loading = signal(false);
  readonly pixData = signal<PixPaymentResponse | null>(null);
  
  private pollingInterval: ReturnType<typeof setInterval> | null = null;
  private pollingInProgress = false;

  async selectPlan(plan: 'monthly' | 'annual') {
    this.loading.set(true);
    try {
      const data = await this.subService.createPixPayment(plan);
      this.pixData.set(data);
      this.startPolling();
    } catch (err: any) {
      this.notify.error(err.message || 'Erro ao gerar o PIX');
    } finally {
      this.loading.set(false);
    }
  }

  async copyPix() {
    const data = this.pixData();
    if (data?.qr_code) {
      await navigator.clipboard.writeText(data.qr_code);
      this.notify.success('Código PIX copiado!');
    }
  }

  cancelPayment() {
    this.stopPolling();
    this.pixData.set(null);
  }

  async logout() {
    this.stopPolling();
    await this.auth.signOut();
  }

  private startPolling() {
    this.stopPolling();
    void this.checkPaymentStatus();
    this.pollingInterval = setInterval(() => void this.checkPaymentStatus(), 5000);
  }

  private async checkPaymentStatus(): Promise<void> {
    if (this.pollingInProgress) return;
    this.pollingInProgress = true;

    try {
      await this.accessService.refreshAccessStatus();
      if (!this.accessService.isPaid()) return;

      await this.auth.reloadProfile();
      this.stopPolling();
      this.pixData.set(null);
      this.notify.success('Pagamento confirmado! Bem-vindo(a) ao Premium.');
      await this.router.navigate(['/dashboard']);
    } catch (error) {
      console.error('Error checking payment status:', error);
    } finally {
      this.pollingInProgress = false;
    }
  }

  private stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  ngOnDestroy() {
    this.stopPolling();
  }
}
