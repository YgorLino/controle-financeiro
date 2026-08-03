// src/app/features/transactions/pages/transactions/transactions.component.ts
import {
  Component, ChangeDetectionStrategy, OnInit, inject,
  signal, computed, HostListener, ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { TransactionService } from '../../../../core/services/transaction.service';
import { CategoryService } from '../../../../core/services/category.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { Transaction, TransactionType, TransactionStatus } from '../../../../core/models/transaction.model';
import { MonthSelectorComponent } from '../../../../shared/components/month-selector/month-selector.component';
import { SkeletonLoaderComponent } from '../../../../shared/components/skeleton-loader/skeleton-loader.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { CurrencyBrPipe } from '../../../../shared/pipes/currency-br.pipe';
import { ReferenceMonthPipe } from '../../../../shared/pipes/reference-month.pipe';
import { TransactionFormComponent } from '../../components/transaction-form/transaction-form.component';
import { exportTransactionsToCsv } from '../../../../shared/utils/csv-export.utils';
import { isOverdue, formatDatePtBr } from '../../../../shared/utils/date.utils';
import { startOfMonth, format } from 'date-fns';

@Component({
  selector: 'app-transactions',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatTableModule, MatPaginatorModule, MatSortModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatMenuModule,
    MatDialogModule, MatTooltipModule, MatProgressBarModule,
    MatChipsModule, MatDividerModule,
    MonthSelectorComponent, SkeletonLoaderComponent,
    EmptyStateComponent, CurrencyBrPipe, ReferenceMonthPipe
  ],
  template: `
    <div class="cm-page">
      <!-- Header -->
      <div class="page-header">
        <div class="header-left">
          <h1 class="page-title">Movimentações</h1>
          <p class="page-subtitle">{{ currentMonthDate() | referenceMonth }}</p>
        </div>
        <div class="header-actions">
          <app-month-selector
            [currentDate]="currentMonthDate()"
            (monthChanged)="onMonthChanged($event)">
          </app-month-selector>

          <button mat-flat-button color="primary" (click)="openForm('income')"
                  id="btn-nova-entrada">
            <mat-icon>add</mat-icon>
            Entrada
          </button>
          <button mat-flat-button color="warn" (click)="openForm('expense')"
                  id="btn-nova-saida">
            <mat-icon>remove</mat-icon>
            Saída
          </button>
          <button mat-stroked-button (click)="exportCsv()" matTooltip="Exportar CSV">
            <mat-icon>download</mat-icon>
            CSV
          </button>
        </div>
      </div>

      <!-- Totais rápidos -->
      <div class="totals-bar fade-up" *ngIf="!loading()">
        <div class="total-item income">
          <mat-icon>trending_up</mat-icon>
          <span>{{ totalIncome() | currencyBr }}</span>
          <small>Entradas</small>
        </div>
        <div class="total-item expense">
          <mat-icon>trending_down</mat-icon>
          <span>{{ totalExpense() | currencyBr }}</span>
          <small>Saídas</small>
        </div>
        <div class="total-item balance" [class.negative]="balance() < 0">
          <mat-icon>account_balance_wallet</mat-icon>
          <span>{{ balance() | currencyBr }}</span>
          <small>Saldo</small>
        </div>
        <button mat-stroked-button class="copy-btn" (click)="copyPreviousMonth()">
          <mat-icon>content_copy</mat-icon>
          Copiar mês anterior
        </button>
      </div>

      <!-- Filtros -->
      <div class="filters-bar fade-up">
        <mat-form-field appearance="outline" class="search-field">
          <mat-label>Pesquisar</mat-label>
          <input matInput [formControl]="searchCtrl" placeholder="Buscar por descrição...">
          <mat-icon matSuffix>search</mat-icon>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Categoria</mat-label>
          <mat-select [formControl]="categoryCtrl">
            <mat-option value="">Todas</mat-option>
            <mat-option *ngFor="let cat of categoryService.categories()" [value]="cat.id">
              <div style="display:flex;align-items:center;gap:8px">
                <span style="width:10px;height:10px;border-radius:50%;display:inline-block"
                      [style.background]="cat.color"></span>
                {{ cat.name }}
              </div>
            </mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Status</mat-label>
          <mat-select [formControl]="statusCtrl">
            <mat-option value="">Todos</mat-option>
            <mat-option value="paid">Pago / Recebido</mat-option>
            <mat-option value="pending">Pendente</mat-option>
            <mat-option value="overdue">Atrasado</mat-option>
            <mat-option value="cancelled">Cancelado</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Tipo</mat-label>
          <mat-select [formControl]="typeCtrl">
            <mat-option value="">Todos</mat-option>
            <mat-option value="income">Entradas</mat-option>
            <mat-option value="expense">Saídas</mat-option>
          </mat-select>
        </mat-form-field>
      </div>

      <!-- Skeleton -->
      <app-skeleton-loader *ngIf="loading()" [count]="5" height="60px"></app-skeleton-loader>

      <!-- Tabela (desktop) -->
      <ng-container *ngIf="!loading() && !isMobile()">
        <div class="cm-table-container fade-up" *ngIf="filteredTransactions().length > 0">
          <table mat-table [dataSource]="filteredTransactions()" class="transactions-table">

            <!-- Descrição -->
            <ng-container matColumnDef="description">
              <th mat-header-cell *matHeaderCellDef>Descrição</th>
              <td mat-cell *matCellDef="let t">
                <div class="desc-cell">
                  <span class="desc-text">{{ t.description }}</span>
                  <span *ngIf="isTransactionOverdue(t)" class="overdue-badge">
                    <mat-icon>warning</mat-icon> Atrasado
                  </span>
                </div>
              </td>
            </ng-container>

            <!-- Entrada -->
            <ng-container matColumnDef="income">
              <th mat-header-cell *matHeaderCellDef>Entrada</th>
              <td mat-cell *matCellDef="let t">
                <span *ngIf="t.transaction_type === 'income'" class="amount income-amount">
                  {{ t.amount | currencyBr }}
                </span>
                <span *ngIf="t.transaction_type !== 'income'" class="amount-dash">—</span>
              </td>
            </ng-container>

            <!-- Saída -->
            <ng-container matColumnDef="expense">
              <th mat-header-cell *matHeaderCellDef>Saída</th>
              <td mat-cell *matCellDef="let t">
                <span *ngIf="t.transaction_type === 'expense'" class="amount expense-amount">
                  {{ t.amount | currencyBr }}
                </span>
                <span *ngIf="t.transaction_type !== 'expense'" class="amount-dash">—</span>
              </td>
            </ng-container>

            <!-- Categoria -->
            <ng-container matColumnDef="category">
              <th mat-header-cell *matHeaderCellDef>Categoria</th>
              <td mat-cell *matCellDef="let t">
                <span *ngIf="t.category" class="cat-chip"
                      [style.background]="t.category.color + '22'"
                      [style.color]="t.category.color">
                  {{ t.category.name }}
                </span>
                <span *ngIf="!t.category" class="cat-chip no-cat">Sem categoria</span>
              </td>
            </ng-container>

            <!-- Vencimento -->
            <ng-container matColumnDef="due_date">
              <th mat-header-cell *matHeaderCellDef>Vencimento</th>
              <td mat-cell *matCellDef="let t">
                <span [class.overdue-date]="isTransactionOverdue(t)">
                  {{ formatDate(t.due_date) }}
                </span>
              </td>
            </ng-container>

            <!-- Status -->
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let t">
                <span class="chip" [ngClass]="'chip-' + (isTransactionOverdue(t) ? 'overdue' : t.status)">
                  {{ getStatusLabel(t) }}
                </span>
              </td>
            </ng-container>

            <!-- Ações -->
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef style="text-align:right">Ações</th>
              <td mat-cell *matCellDef="let t" class="actions-cell">
                <!-- Marcar pago (rápido) -->
                <button mat-icon-button color="primary"
                        *ngIf="t.status !== 'paid'"
                        (click)="markAsPaid(t)"
                        matTooltip="Marcar como pago">
                  <mat-icon>check_circle_outline</mat-icon>
                </button>
                <!-- Marcar pendente -->
                <button mat-icon-button
                        *ngIf="t.status === 'paid'"
                        (click)="markAsPending(t)"
                        matTooltip="Marcar como pendente">
                  <mat-icon>radio_button_unchecked</mat-icon>
                </button>

                <button mat-icon-button [matMenuTriggerFor]="actionMenu">
                  <mat-icon>more_vert</mat-icon>
                </button>

                <mat-menu #actionMenu="matMenu">
                  <button mat-menu-item (click)="openForm(undefined, t)">
                    <mat-icon>edit</mat-icon> Editar
                  </button>
                  <button mat-menu-item (click)="duplicate(t)">
                    <mat-icon>content_copy</mat-icon> Duplicar
                  </button>
                  <mat-divider></mat-divider>
                  <button mat-menu-item (click)="confirmDelete(t.id)" class="delete-item">
                    <mat-icon>delete</mat-icon> Excluir
                  </button>
                </mat-menu>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;"
                [class.overdue-row]="isTransactionOverdue(row)">
            </tr>
          </table>
        </div>

        <!-- Empty state -->
        <app-empty-state
          *ngIf="!loading() && filteredTransactions().length === 0"
          icon="receipt_long"
          title="Nenhuma movimentação encontrada neste mês"
          message="Comece adicionando suas entradas e saídas para este período."
          actionLabel="Adicionar movimentação"
          (action)="openForm()">
        </app-empty-state>
      </ng-container>

      <!-- Cards (mobile) -->
      <ng-container *ngIf="!loading() && isMobile()">
        <div class="mobile-cards fade-up" *ngIf="filteredTransactions().length > 0">
          <div *ngFor="let t of filteredTransactions()" class="transaction-card"
               [class.overdue-row]="isTransactionOverdue(t)">
            <div class="card-row">
              <div class="card-left">
                <span class="card-desc">{{ t.description }}</span>
                <span *ngIf="t.category" class="cat-chip mini"
                      [style.background]="t.category.color + '22'"
                      [style.color]="t.category.color">
                  {{ t.category.name }}
                </span>
              </div>
              <div class="card-right">
                <span class="card-amount"
                      [class.income-amount]="t.transaction_type === 'income'"
                      [class.expense-amount]="t.transaction_type === 'expense'">
                  {{ t.transaction_type === 'income' ? '+' : '-' }} {{ t.amount | currencyBr }}
                </span>
                <span class="chip mini" [ngClass]="'chip-' + (isTransactionOverdue(t) ? 'overdue' : t.status)">
                  {{ getStatusLabel(t) }}
                </span>
              </div>
            </div>
            <div class="card-footer">
              <span>{{ formatDate(t.due_date) }}</span>
              <div class="card-actions">
                <button mat-icon-button (click)="markAsPaid(t)"
                        *ngIf="t.status !== 'paid'" matTooltip="Pago">
                  <mat-icon>check_circle_outline</mat-icon>
                </button>
                <button mat-icon-button (click)="openForm(undefined, t)" matTooltip="Editar">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button (click)="confirmDelete(t.id)" matTooltip="Excluir">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            </div>
          </div>
        </div>

        <app-empty-state
          *ngIf="filteredTransactions().length === 0"
          icon="receipt_long"
          title="Nenhuma movimentação"
          message="Adicione entradas e saídas para este mês."
          actionLabel="Adicionar"
          (action)="openForm()">
        </app-empty-state>
      </ng-container>
    </div>
  `,
  styles: [`
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
      flex-wrap: wrap;
      gap: 16px;
    }
    .page-title { font-size: 1.5rem; font-weight: 700; color: var(--cm-text); margin: 0; }
    .page-subtitle { color: var(--cm-text-muted); font-size: .875rem; margin: 4px 0 0; }
    .header-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .totals-bar {
      display: flex;
      align-items: center;
      gap: 24px;
      background: var(--cm-surface);
      border: 1px solid var(--cm-border);
      border-radius: var(--cm-radius);
      padding: 16px 20px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .total-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      min-width: 100px;
      mat-icon { font-size: 20px; width: 20px; height: 20px; margin-bottom: 2px; }
      span { font-size: 1.125rem; font-weight: 700; }
      small { font-size: .75rem; color: var(--cm-text-muted); }
      &.income mat-icon, &.income span { color: var(--cm-income); }
      &.expense mat-icon, &.expense span { color: var(--cm-expense); }
      &.balance mat-icon, &.balance span { color: var(--cm-primary); }
      &.balance.negative mat-icon, &.balance.negative span { color: var(--cm-expense); }
    }
    .copy-btn { margin-left: auto; display: flex; align-items: center; gap: 6px; }

    .filters-bar {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
      flex-wrap: wrap;
      align-items: flex-start;
    }
    .search-field { flex: 1; min-width: 200px; }

    .desc-cell { display: flex; flex-direction: column; gap: 2px; }
    .desc-text { font-weight: 500; }
    .overdue-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: .7rem;
      color: var(--cm-overdue);
      font-weight: 600;
      mat-icon { font-size: 12px; width: 12px; height: 12px; }
    }

    .amount { font-weight: 600; font-size: .9375rem; }
    .income-amount { color: var(--cm-income); }
    .expense-amount { color: var(--cm-expense); }
    .amount-dash { color: var(--cm-text-muted); }

    .cat-chip {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 99px;
      font-size: .75rem;
      font-weight: 600;
    }
    .no-cat { background: var(--cm-surface-2); color: var(--cm-text-muted); }

    .overdue-date { color: var(--cm-overdue); font-weight: 600; }

    .actions-cell {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 4px;
    }
    .delete-item { color: var(--cm-warn) !important; }

    /* Mobile cards */
    .mobile-cards { display: flex; flex-direction: column; gap: 10px; }
    .transaction-card {
      background: var(--cm-surface);
      border: 1px solid var(--cm-border);
      border-radius: var(--cm-radius);
      padding: 14px 16px;
      box-shadow: var(--cm-shadow);
      &.overdue-row { border-left: 3px solid var(--cm-overdue); }
    }
    .card-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 8px; }
    .card-left { display: flex; flex-direction: column; gap: 4px; }
    .card-desc { font-weight: 600; font-size: .9375rem; color: var(--cm-text); }
    .card-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
    .card-amount { font-weight: 700; font-size: 1rem; }
    .card-footer { display: flex; justify-content: space-between; align-items: center; }
    .card-footer span { font-size: .8125rem; color: var(--cm-text-muted); }
    .card-actions { display: flex; gap: 4px; }
    .cat-chip.mini, .chip.mini { font-size: .7rem; padding: 1px 6px; }
  `]
})
export class TransactionsComponent implements OnInit {
  readonly transactionService = inject(TransactionService);
  readonly categoryService = inject(CategoryService);
  private readonly notify = inject(NotificationService);
  private readonly dialog = inject(MatDialog);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(false);
  readonly currentMonthDate = signal(startOfMonth(new Date()));
  readonly isMobile = signal(window.innerWidth < 768);

  readonly searchCtrl = this.fb.control('');
  readonly categoryCtrl = this.fb.control('');
  readonly statusCtrl = this.fb.control('');
  readonly typeCtrl = this.fb.control('');

  readonly displayedColumns = ['description', 'income', 'expense', 'category', 'due_date', 'status', 'actions'];

  @HostListener('window:resize')
  onResize(): void {
    this.isMobile.set(window.innerWidth < 768);
  }

  readonly filteredTransactions = computed(() => {
    const search = (this.searchCtrl.value ?? '').toLowerCase();
    const cat = this.categoryCtrl.value ?? '';
    const status = this.statusCtrl.value ?? '';
    const type = this.typeCtrl.value ?? '';

    return this.transactionService.transactions().filter(t => {
      if (search && !t.description.toLowerCase().includes(search)) return false;
      if (cat && t.category_id !== cat) return false;
      if (status && t.status !== status) return false;
      if (type && t.transaction_type !== type) return false;
      return true;
    });
  });

  readonly totalIncome = computed(() =>
    this.filteredTransactions()
      .filter(t => t.transaction_type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0)
  );

  readonly totalExpense = computed(() =>
    this.filteredTransactions()
      .filter(t => t.transaction_type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0)
  );

  readonly balance = computed(() => this.totalIncome() - this.totalExpense());

  async ngOnInit(): Promise<void> {
    await this.loadData();

    // Abrir form via queryParams (?new=income ou ?new=expense)
    this.route.queryParams.subscribe(params => {
      if (params['new']) {
        const type = params['new'] as TransactionType;
        this.openForm(type);
      }
    });
  }

  async onMonthChanged(date: Date): Promise<void> {
    this.currentMonthDate.set(date);
    this.transactionService.setCurrentMonth(date);
    await this.loadData();
  }

  private async loadData(): Promise<void> {
    this.loading.set(true);
    try {
      const monthStr = this.transactionService.getReferenceMonthString(this.currentMonthDate());
      await Promise.all([
        this.transactionService.loadTransactions(monthStr),
        this.categoryService.loadCategories()
      ]);
    } catch {
      this.notify.error('Não foi possível carregar as movimentações.');
    } finally {
      this.loading.set(false);
    }
  }

  openForm(defaultType?: TransactionType, transaction?: Transaction): void {
    const ref = this.dialog.open(TransactionFormComponent, {
      width: '600px',
      maxWidth: '98vw',
      data: {
        transaction,
        defaultType,
        defaultMonth: this.transactionService.getReferenceMonthString(this.currentMonthDate())
      }
    });
    // Dialog fechando com true = recarregar (já atualizado via signal)
  }

  confirmDelete(id: string): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Excluir movimentação',
        message: 'Tem certeza que deseja excluir esta movimentação? Esta ação não pode ser desfeita.',
        confirmLabel: 'Excluir',
        danger: true
      }
    });
    ref.afterClosed().subscribe(async confirmed => {
      if (!confirmed) return;
      try {
        await this.transactionService.deleteTransaction(id);
        this.notify.success('Movimentação excluída com sucesso.');
      } catch {
        this.notify.error('Não foi possível excluir a movimentação.');
      }
    });
  }

  async markAsPaid(t: Transaction): Promise<void> {
    try {
      await this.transactionService.updateStatus(t.id, 'paid');
      this.notify.success('Status atualizado com sucesso.');
    } catch {
      this.notify.error('Não foi possível atualizar o status.');
    }
  }

  async markAsPending(t: Transaction): Promise<void> {
    try {
      await this.transactionService.updateStatus(t.id, 'pending');
      this.notify.success('Status atualizado com sucesso.');
    } catch {
      this.notify.error('Não foi possível atualizar o status.');
    }
  }

  async duplicate(t: Transaction): Promise<void> {
    try {
      await this.transactionService.duplicateTransaction(t);
      this.notify.success('Movimentação duplicada com sucesso.');
    } catch {
      this.notify.error('Não foi possível duplicar a movimentação.');
    }
  }

  async copyPreviousMonth(): Promise<void> {
    const monthStr = this.transactionService.getReferenceMonthString(this.currentMonthDate());
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Copiar mês anterior',
        message: 'Isso irá copiar todas as movimentações do mês anterior para o mês atual, marcando-as como pendente. Deseja continuar?',
        confirmLabel: 'Copiar',
        danger: false
      }
    });
    ref.afterClosed().subscribe(async confirmed => {
      if (!confirmed) return;
      try {
        const count = await this.transactionService.copyPreviousMonth(monthStr);
        this.notify.success(`${count} movimentação(ões) copiada(s) com sucesso.`);
      } catch {
        this.notify.error('Não foi possível copiar as movimentações.');
      }
    });
  }

  exportCsv(): void {
    exportTransactionsToCsv(this.filteredTransactions(), 'movimentacoes');
    this.notify.success('Arquivo CSV exportado com sucesso.');
  }

  isTransactionOverdue(t: Transaction): boolean {
    return isOverdue(t.due_date, t.status);
  }

  formatDate(date: string | null): string {
    return formatDatePtBr(date);
  }

  getStatusLabel(t: Transaction): string {
    if (this.isTransactionOverdue(t)) return 'Atrasado';
    const labels: Record<string, string> = {
      paid: t.transaction_type === 'income' ? 'Recebido' : 'Pago',
      pending: t.transaction_type === 'income' ? 'A receber' : 'Pendente',
      overdue: 'Atrasado',
      cancelled: 'Cancelado'
    };
    return labels[t.status] ?? t.status;
  }
}
