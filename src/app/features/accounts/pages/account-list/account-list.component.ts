// src/app/features/accounts/pages/account-list/account-list.component.ts
import { Component, ChangeDetectionStrategy, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { AccountService } from '../../../../core/services/account.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { Account } from '../../../../core/models/account.model';
import { AccountFormComponent } from '../../components/account-form/account-form.component';

@Component({
  selector: 'app-account-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, MatButtonModule, MatIconModule, MatDialogModule,
    MatProgressSpinnerModule, MatMenuModule
  ],
  templateUrl: './account-list.component.html',
  styleUrl: './account-list.component.scss'
})
export class AccountListComponent implements OnInit {
  private readonly accountService = inject(AccountService);
  private readonly dialog = inject(MatDialog);
  private readonly notify = inject(NotificationService);

  readonly accounts = this.accountService.accounts;
  readonly loading = signal(true);
  readonly totalBalance = signal(0);

  async ngOnInit(): Promise<void> {
    await this.loadAccounts();
  }

  async loadAccounts(): Promise<void> {
    this.loading.set(true);
    try {
      await this.accountService.loadAccounts();
      this.calculateTotal();
    } catch (error) {
      this.notify.error('Erro ao carregar contas');
    } finally {
      this.loading.set(false);
    }
  }

  calculateTotal(): void {
    const total = this.accounts().reduce((acc, curr) => acc + curr.initial_balance, 0);
    this.totalBalance.set(total);
  }

  openAccountForm(account?: Account): void {
    const dialogRef = this.dialog.open(AccountFormComponent, {
      data: { account },
      width: '100%',
      maxWidth: '450px'
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        await this.loadAccounts();
      }
    });
  }

  async deleteAccount(id: string): Promise<void> {
    if (confirm('Tem certeza que deseja excluir esta conta? Todas as movimentações atreladas ficarão sem conta!')) {
      try {
        await this.accountService.deleteAccount(id);
        this.notify.success('Conta excluída com sucesso!');
        await this.loadAccounts();
      } catch (error) {
        this.notify.error('Erro ao excluir conta');
      }
    }
  }
}
