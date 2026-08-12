// src/app/features/settings/pages/settings/settings.component.ts
import {
  Component, ChangeDetectionStrategy, OnInit, inject, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
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
import { AccessService } from '../../../../core/services/access.service';

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
    CommonModule, RouterLink, ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatButtonModule,
    MatIconModule, MatDividerModule, MatProgressSpinnerModule,
    MatButtonToggleModule, MatTooltipModule
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly themeService = inject(ThemeService);
  private readonly notify = inject(NotificationService);
  public readonly accessService = inject(AccessService);

  readonly profileLoading = signal(false);
  readonly passwordLoading = signal(false);
  readonly showPwd = signal(false);

  readonly currentTheme = this.themeService.theme;

  readonly profileForm = this.formBuilder.group({
    name: ['', Validators.required],
    email: [{ value: '', disabled: true }]
  });

  readonly passwordForm = this.formBuilder.group({
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
