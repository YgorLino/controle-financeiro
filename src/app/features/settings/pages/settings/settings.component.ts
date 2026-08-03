// src/app/features/settings/pages/settings/settings.component.ts
import {
  Component, ChangeDetectionStrategy, OnInit, inject, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../../../core/services/auth.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ThemeService, Theme } from '../../../../core/services/theme.service';

function passwordMatchValidator(control: AbstractControl) {
  const pass = control.get('newPassword')?.value;
  const confirm = control.get('confirmPassword')?.value;
  return pass === confirm ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatButtonModule,
    MatIconModule, MatDividerModule, MatProgressSpinnerModule,
    MatButtonToggleModule, MatTooltipModule
  ],
  template: `
    <div class="cm-page settings-page">
      <div class="page-header">
        <h1 class="page-title">Configurações</h1>
        <p class="page-subtitle">Gerencie seu perfil e preferências</p>
      </div>

      <div class="settings-grid">

        <!-- Perfil -->
        <div class="cm-card settings-section">
          <h2 class="cm-section-title">
            <mat-icon>person</mat-icon>
            Perfil
          </h2>

          <form [formGroup]="profileForm" (ngSubmit)="saveProfile()" class="settings-form">
            <mat-form-field appearance="outline">
              <mat-label>Nome completo</mat-label>
              <input matInput formControlName="name">
              <mat-error *ngIf="profileForm.get('name')?.hasError('required')">
                Informe seu nome.
              </mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>E-mail</mat-label>
              <input matInput formControlName="email" readonly>
              <mat-icon matSuffix matTooltip="O e-mail não pode ser alterado">lock</mat-icon>
            </mat-form-field>

            <div class="user-meta">
              <div class="user-avatar-large">
                {{ userInitial() }}
              </div>
              <div>
                <p class="user-since">Usuário desde</p>
                <p class="user-date">{{ userSince() }}</p>
              </div>
            </div>

            <button mat-flat-button color="primary" type="submit"
                    class="save-btn" [disabled]="profileLoading()">
              <mat-spinner *ngIf="profileLoading()" diameter="18"></mat-spinner>
              <mat-icon *ngIf="!profileLoading()">save</mat-icon>
              Salvar perfil
            </button>
          </form>
        </div>

        <!-- Senha -->
        <div class="cm-card settings-section">
          <h2 class="cm-section-title">
            <mat-icon>lock</mat-icon>
            Alterar senha
          </h2>

          <form [formGroup]="passwordForm" (ngSubmit)="savePassword()" class="settings-form">
            <mat-form-field appearance="outline">
              <mat-label>Nova senha</mat-label>
              <input matInput [type]="showPwd() ? 'text' : 'password'"
                     formControlName="newPassword">
              <button mat-icon-button matSuffix type="button"
                      (click)="showPwd.set(!showPwd())">
                <mat-icon>{{ showPwd() ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
              <mat-error *ngIf="passwordForm.get('newPassword')?.hasError('minlength')">
                Mínimo 6 caracteres.
              </mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Confirmar nova senha</mat-label>
              <input matInput [type]="showPwd() ? 'text' : 'password'"
                     formControlName="confirmPassword">
              <mat-error *ngIf="passwordForm.hasError('passwordMismatch')">
                As senhas não coincidem.
              </mat-error>
            </mat-form-field>

            <button mat-flat-button color="primary" type="submit"
                    class="save-btn" [disabled]="passwordLoading()">
              <mat-spinner *ngIf="passwordLoading()" diameter="18"></mat-spinner>
              <mat-icon *ngIf="!passwordLoading()">lock_reset</mat-icon>
              Alterar senha
            </button>
          </form>
        </div>

        <!-- Tema -->
        <div class="cm-card settings-section">
          <h2 class="cm-section-title">
            <mat-icon>palette</mat-icon>
            Aparência
          </h2>

          <p class="section-hint">Escolha como o sistema deve aparecer para você.</p>

          <mat-button-toggle-group
            [value]="currentTheme()"
            (change)="setTheme($event.value)"
            class="theme-toggle">
            <mat-button-toggle value="light">
              <mat-icon>light_mode</mat-icon>
              Claro
            </mat-button-toggle>
            <mat-button-toggle value="dark">
              <mat-icon>dark_mode</mat-icon>
              Escuro
            </mat-button-toggle>
            <mat-button-toggle value="system">
              <mat-icon>settings_brightness</mat-icon>
              Sistema
            </mat-button-toggle>
          </mat-button-toggle-group>
        </div>

        <!-- Conta -->
        <div class="cm-card settings-section danger-zone">
          <h2 class="cm-section-title">
            <mat-icon>account_circle</mat-icon>
            Conta
          </h2>

          <p class="section-hint">Sair da sua conta neste dispositivo.</p>

          <button mat-stroked-button color="warn" (click)="signOut()" class="logout-btn">
            <mat-icon>logout</mat-icon>
            Sair da conta
          </button>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .settings-page { max-width: 900px; }
    .page-header { margin-bottom: 24px; }
    .page-title { font-size: 1.5rem; font-weight: 700; color: var(--cm-text); margin: 0; }
    .page-subtitle { color: var(--cm-text-muted); font-size: .875rem; margin: 4px 0 0; }

    .settings-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
      gap: 20px;
    }

    .settings-section {
      display: flex;
      flex-direction: column;
    }

    .cm-section-title {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 20px;
      mat-icon { color: var(--cm-primary); }
    }

    .settings-form {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .save-btn {
      align-self: flex-start;
      margin-top: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .user-meta {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 12px 0;
    }

    .user-avatar-large {
      width: 56px; height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, #4f46e5, #7c3aed);
      color: white;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.5rem; font-weight: 700;
      flex-shrink: 0;
    }

    .user-since { font-size: .75rem; color: var(--cm-text-muted); margin: 0; }
    .user-date { font-size: .875rem; font-weight: 600; color: var(--cm-text); margin: 2px 0 0; }

    .section-hint { color: var(--cm-text-muted); font-size: .875rem; margin-bottom: 16px; }

    .theme-toggle {
      width: 100%;
      mat-button-toggle {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        mat-icon { margin: 0; }
      }
    }

    .danger-zone .cm-section-title mat-icon { color: var(--cm-warn); }

    .logout-btn {
      align-self: flex-start;
      display: flex;
      align-items: center;
      gap: 8px;
    }
  `]
})
export class SettingsComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly themeService = inject(ThemeService);
  private readonly fb = inject(FormBuilder);

  readonly profileLoading = signal(false);
  readonly passwordLoading = signal(false);
  readonly showPwd = signal(false);

  readonly currentTheme = this.themeService.theme;

  readonly profileForm = this.fb.group({
    name: ['', Validators.required],
    email: [{ value: '', disabled: true }]
  });

  readonly passwordForm = this.fb.group({
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', Validators.required]
  }, { validators: passwordMatchValidator });

  ngOnInit(): void {
    const profile = this.auth.profile();
    if (profile) {
      this.profileForm.patchValue({
        name: profile.name,
        email: profile.email
      });
    }
  }

  userInitial(): string {
    return (this.auth.profile()?.name ?? 'U').charAt(0).toUpperCase();
  }

  userSince(): string {
    const date = this.auth.profile()?.created_at;
    if (!date) return '—';
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'long', year: 'numeric'
    });
  }

  async saveProfile(): Promise<void> {
    if (this.profileForm.invalid) { this.profileForm.markAllAsTouched(); return; }
    this.profileLoading.set(true);
    try {
      await this.auth.updateProfile({ name: this.profileForm.value.name! });
      this.notify.success('Perfil atualizado com sucesso.');
    } catch (err: any) {
      this.notify.error(err?.message ?? 'Não foi possível atualizar o perfil.');
    } finally {
      this.profileLoading.set(false);
    }
  }

  async savePassword(): Promise<void> {
    if (this.passwordForm.invalid) { this.passwordForm.markAllAsTouched(); return; }
    this.passwordLoading.set(true);
    try {
      await this.auth.updatePassword(this.passwordForm.value.newPassword!);
      this.notify.success('Senha alterada com sucesso.');
      this.passwordForm.reset();
    } catch (err: any) {
      this.notify.error(err?.message ?? 'Não foi possível alterar a senha.');
    } finally {
      this.passwordLoading.set(false);
    }
  }

  setTheme(theme: Theme): void {
    this.themeService.setTheme(theme);
  }

  async signOut(): Promise<void> {
    await this.auth.signOut();
  }
}
