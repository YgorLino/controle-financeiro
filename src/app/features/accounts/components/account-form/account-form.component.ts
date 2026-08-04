// src/app/features/accounts/components/account-form/account-form.component.ts
import { Component, ChangeDetectionStrategy, inject, signal, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AccountService } from '../../../../core/services/account.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { Account } from '../../../../core/models/account.model';

@Component({
  selector: 'app-account-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ReactiveFormsModule, MatDialogModule,
    MatFormFieldModule, MatInputModule, MatButtonModule,
    MatIconModule, MatProgressSpinnerModule
  ],
  templateUrl: './account-form.component.html',
  styleUrl: './account-form.component.scss'
})
export class AccountFormComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<AccountFormComponent>);
  private readonly accountService = inject(AccountService);
  private readonly notify = inject(NotificationService);
  private readonly fb = inject(FormBuilder);

  readonly data: { account?: Account } = inject(MAT_DIALOG_DATA) ?? {};
  readonly loading = signal(false);

  readonly colors = [
    '#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
    '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6', '#f97316'
  ];

  get isEdit(): boolean { return !!this.data.account; }

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    color: ['#6366f1', Validators.required],
    initial_balance: [0, [Validators.required]]
  });

  ngOnInit(): void {
    if (this.data.account) {
      this.form.patchValue({
        name: this.data.account.name,
        color: this.data.account.color,
        initial_balance: this.data.account.initial_balance
      });
    }
  }

  selectColor(c: string): void {
    this.form.patchValue({ color: c });
  }

  async onSave(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    try {
      const val = this.form.value;
      const payload = {
        name: val.name as string,
        color: val.color as string,
        initial_balance: Number(val.initial_balance)
      };

      if (this.isEdit) {
        await this.accountService.updateAccount(this.data.account!.id, payload);
        this.notify.success('Conta atualizada!');
      } else {
        await this.accountService.createAccount(payload);
        this.notify.success('Conta criada!');
      }
      this.dialogRef.close(true);
    } catch (err: any) {
      this.notify.error(err?.message ?? 'Erro ao salvar conta.');
    } finally {
      this.loading.set(false);
    }
  }
}
