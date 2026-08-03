// src/app/features/auth/pages/login/login.component.ts
import {
  Component, ChangeDetectionStrategy, inject, signal
} from '@angular/core';
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
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
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
        <h2>Bem-vindo de volta</h2>
        <p>Entre na sua conta para continuar</p>
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="auth-form">
        <mat-form-field appearance="outline">
          <mat-label>E-mail</mat-label>
          <input matInput type="email" formControlName="email"
                 placeholder="seu@email.com" autocomplete="email">
          <mat-icon matSuffix>mail</mat-icon>
          <mat-error *ngIf="form.get('email')?.hasError('required')">Informe seu e-mail.</mat-error>
          <mat-error *ngIf="form.get('email')?.hasError('email')">E-mail inválido.</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Senha</mat-label>
          <input matInput [type]="showPassword() ? 'text' : 'password'"
                 formControlName="password" autocomplete="current-password">
          <button mat-icon-button matSuffix type="button"
                  (click)="showPassword.set(!showPassword())">
            <mat-icon>{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
          </button>
          <mat-error *ngIf="form.get('password')?.hasError('required')">Informe sua senha.</mat-error>
        </mat-form-field>

        <div class="forgot-link">
          <a routerLink="/auth/reset-password">Esqueceu a senha?</a>
        </div>

        <button mat-flat-button color="primary" type="submit"
                class="submit-btn" [disabled]="loading()">
          <mat-spinner *ngIf="loading()" diameter="20"></mat-spinner>
          <span *ngIf="!loading()">Entrar</span>
        </button>
      </form>

      <p class="auth-footer">
        Não tem conta?
        <a routerLink="/auth/register">Criar conta</a>
      </p>
    </div>
  `,
  styles: [`
    .auth-card { width: 100%; max-width: 420px; }
    .auth-header { margin-bottom: 32px; text-align: center; }
    .auth-header h2 { font-size: 1.75rem; font-weight: 700; color: var(--cm-text); margin-bottom: 8px; }
    .auth-header p { color: var(--cm-text-muted); }
    .auth-form { display: flex; flex-direction: column; gap: 4px; }
    .forgot-link { text-align: right; margin: -4px 0 8px; }
    .forgot-link a { font-size: .875rem; color: var(--cm-primary); }
    .submit-btn {
      width: 100%; height: 48px; font-size: 1rem; font-weight: 600;
      margin-top: 8px; display: flex; align-items: center; justify-content: center; gap: 8px;
    }
    .auth-footer { text-align: center; margin-top: 24px; color: var(--cm-text-muted); font-size: .9375rem; }
    .auth-footer a { font-weight: 600; color: var(--cm-primary); }
  `]
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(false);
  readonly showPassword = signal(false);

  readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]]
  });

  async onSubmit(): Promise<void> {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    try {
      await this.auth.signIn(this.form.value.email!, this.form.value.password!);
      this.router.navigate(['/dashboard']);
    } catch (err: any) {
      this.notify.error(err?.message ?? 'Não foi possível realizar o login.');
    } finally {
      this.loading.set(false);
    }
  }
}
