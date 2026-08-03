// src/app/features/auth/pages/register/register.component.ts
import {
  Component, ChangeDetectionStrategy, inject, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../../core/services/auth.service';
import { NotificationService } from '../../../../core/services/notification.service';

function passwordMatch(control: AbstractControl) {
  const password = control.get('password')?.value;
  const confirm = control.get('confirmPassword')?.value;
  return password === confirm ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-register',
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
        <h2>Criar conta</h2>
        <p>Comece a organizar suas finanças hoje</p>
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="auth-form">
        <mat-form-field appearance="outline">
          <mat-label>Nome completo</mat-label>
          <input matInput formControlName="name" placeholder="Seu nome" autocomplete="name">
          <mat-icon matSuffix>person</mat-icon>
          <mat-error *ngIf="form.get('name')?.hasError('required')">Informe seu nome.</mat-error>
          <mat-error *ngIf="form.get('name')?.hasError('minlength')">Mínimo 2 caracteres.</mat-error>
        </mat-form-field>

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
          <input matInput [type]="showPwd() ? 'text' : 'password'"
                 formControlName="password" autocomplete="new-password">
          <button mat-icon-button matSuffix type="button" (click)="showPwd.set(!showPwd())">
            <mat-icon>{{ showPwd() ? 'visibility_off' : 'visibility' }}</mat-icon>
          </button>
          <mat-error *ngIf="form.get('password')?.hasError('required')">Informe uma senha.</mat-error>
          <mat-error *ngIf="form.get('password')?.hasError('minlength')">Mínimo 6 caracteres.</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Confirmar senha</mat-label>
          <input matInput [type]="showPwd() ? 'text' : 'password'"
                 formControlName="confirmPassword" autocomplete="new-password">
          <mat-error *ngIf="form.get('confirmPassword')?.hasError('required')">Confirme sua senha.</mat-error>
          <mat-error *ngIf="form.hasError('passwordMismatch')">As senhas não coincidem.</mat-error>
        </mat-form-field>

        <button mat-flat-button color="primary" type="submit"
                class="submit-btn" [disabled]="loading()">
          <mat-spinner *ngIf="loading()" diameter="20"></mat-spinner>
          <span *ngIf="!loading()">Criar conta</span>
        </button>
      </form>

      <p class="auth-footer">
        Já tem conta? <a routerLink="/auth/login">Entrar</a>
      </p>
    </div>
  `,
  styles: [`
    .auth-card { width: 100%; max-width: 420px; }
    .auth-header { margin-bottom: 32px; text-align: center; }
    .auth-header h2 { font-size: 1.75rem; font-weight: 700; color: var(--cm-text); margin-bottom: 8px; }
    .auth-header p { color: var(--cm-text-muted); }
    .auth-form { display: flex; flex-direction: column; gap: 4px; }
    .submit-btn {
      width: 100%; height: 48px; font-size: 1rem; font-weight: 600;
      margin-top: 8px; display: flex; align-items: center; justify-content: center; gap: 8px;
    }
    .auth-footer { text-align: center; margin-top: 24px; color: var(--cm-text-muted); font-size: .9375rem; }
    .auth-footer a { font-weight: 600; color: var(--cm-primary); }
  `]
})
export class RegisterComponent {
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(false);
  readonly showPwd = signal(false);

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]]
  }, { validators: passwordMatch });

  async onSubmit(): Promise<void> {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    try {
      await this.auth.signUp(
        this.form.value.email!,
        this.form.value.password!,
        this.form.value.name!
      );
      this.notify.success('Conta criada! Verifique seu e-mail para confirmar.');
      this.router.navigate(['/auth/login']);
    } catch (err: any) {
      this.notify.error(err?.message ?? 'Não foi possível criar sua conta.');
    } finally {
      this.loading.set(false);
    }
  }
}
