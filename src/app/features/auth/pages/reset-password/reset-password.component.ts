// src/app/features/auth/pages/reset-password/reset-password.component.ts
import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../../core/services/auth.service';
import { NotificationService } from '../../../../core/services/notification.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, RouterLink, ReactiveFormsModule,
    MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule
  ],
  template: `
    <div class="auth-card fade-up">
      <div class="auth-header">
        <h2>Recuperar senha</h2>
        <p *ngIf="!sent()">Enviaremos um link de recuperação para o seu e-mail.</p>
        <p *ngIf="sent()" class="success-msg">
          ✅ Link enviado! Verifique sua caixa de entrada e spam.
        </p>
      </div>

      <form *ngIf="!sent()" [formGroup]="form" (ngSubmit)="onSubmit()" class="auth-form">
        <mat-form-field appearance="outline">
          <mat-label>E-mail cadastrado</mat-label>
          <input matInput type="email" formControlName="email" placeholder="seu@email.com">
          <mat-icon matSuffix>mail</mat-icon>
          <mat-error *ngIf="form.get('email')?.hasError('required')">Informe seu e-mail.</mat-error>
          <mat-error *ngIf="form.get('email')?.hasError('email')">E-mail inválido.</mat-error>
        </mat-form-field>

        <button mat-flat-button color="primary" type="submit"
                class="submit-btn" [disabled]="loading()">
          <mat-spinner *ngIf="loading()" diameter="20"></mat-spinner>
          <span *ngIf="!loading()">Enviar link de recuperação</span>
        </button>
      </form>

      <p class="auth-footer">
        <a routerLink="/auth/login">← Voltar ao login</a>
      </p>
    </div>
  `,
  styles: [`
    .auth-card { width: 100%; max-width: 420px; }
    .auth-header { margin-bottom: 32px; text-align: center; }
    .auth-header h2 { font-size: 1.75rem; font-weight: 700; color: var(--cm-text); margin-bottom: 8px; }
    .auth-header p { color: var(--cm-text-muted); line-height: 1.6; }
    .success-msg { color: var(--cm-accent) !important; font-weight: 500; }
    .auth-form { display: flex; flex-direction: column; gap: 4px; }
    .submit-btn {
      width: 100%; height: 48px; font-size: 1rem; font-weight: 600;
      margin-top: 8px; display: flex; align-items: center; justify-content: center; gap: 8px;
    }
    .auth-footer { text-align: center; margin-top: 24px; font-size: .9375rem; }
    .auth-footer a { color: var(--cm-primary); font-weight: 500; }
  `]
})
export class ResetPasswordComponent {
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(false);
  readonly sent = signal(false);

  readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]]
  });

  async onSubmit(): Promise<void> {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    try {
      await this.auth.resetPassword(this.form.value.email!);
      this.sent.set(true);
    } catch (err: any) {
      this.notify.error(err?.message ?? 'Não foi possível enviar o link.');
    } finally {
      this.loading.set(false);
    }
  }
}
