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
import { Transaction, TransactionType, TransactionStatus, DashboardSummary } from '../../../../core/models/transaction.model';
import { MonthSelectorComponent } from '../../../../shared/components/month-selector/month-selector.component';
import { SkeletonLoaderComponent } from '../../../../shared/components/skeleton-loader/skeleton-loader.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { AmortizationDialogComponent } from '../../../../shared/components/amortization-dialog/amortization-dialog.component';
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
  templateUrl: './transactions.component.html',
  styleUrl: './transactions.component.scss'
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

  readonly summary = signal<DashboardSummary | null>(null);

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

  readonly totalIncome = computed(() => {
    const s = this.summary();
    const pending = this.filteredTransactions()
      .filter(t => t.transaction_type === 'income' && t.status !== 'paid' && t.status !== 'cancelled')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    return (s?.realized_income ?? 0) + pending;
  });

  readonly totalExpense = computed(() => {
    const s = this.summary();
    const pending = this.filteredTransactions()
      .filter(t => t.transaction_type === 'expense' && t.status !== 'paid' && t.status !== 'cancelled')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    return (s?.realized_expense ?? 0) + pending;
  });

  readonly realizedIncome = computed(() => {
    return this.summary()?.realized_income ?? 0;
  });

  readonly realizedExpense = computed(() => {
    return this.summary()?.realized_expense ?? 0;
  });

  readonly projectedBalance = computed(() => this.totalIncome() - this.totalExpense());
  readonly realizedBalance = computed(() => this.realizedIncome() - this.realizedExpense());

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
      const [_, __, s] = await Promise.all([
        this.transactionService.loadTransactions(monthStr),
        this.categoryService.loadCategories(),
        this.transactionService.getDashboardSummary(monthStr)
      ]);
      this.summary.set(s);
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

    ref.afterClosed().subscribe(saved => {
      if (!saved) return;
      void this.refreshAfterMutation(true);
    });
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
        await this.refreshAfterMutation();
      } catch {
        this.notify.error('Não foi possível excluir a movimentação.');
      }
    });
  }

  private async refreshTransactionsAndSummary(): Promise<void> {
    const monthStr = this.transactionService.getReferenceMonthString(this.currentMonthDate());
    const [_, summary] = await Promise.all([
      this.transactionService.loadTransactions(monthStr),
      this.transactionService.getDashboardSummary(monthStr)
    ]);
    this.summary.set(summary);
  }

  private async refreshAfterMutation(reloadTransactions = false): Promise<void> {
    try {
      if (reloadTransactions) {
        await this.refreshTransactionsAndSummary();
      } else {
        await this.refreshSummary();
      }
    } catch {
      this.notify.error('A alteração foi salva, mas não foi possível atualizar os totais. Atualize a página.');
    }
  }

  private async refreshSummary(): Promise<void> {
    const monthStr = this.transactionService.getReferenceMonthString(this.currentMonthDate());
    const s = await this.transactionService.getDashboardSummary(monthStr);
    this.summary.set(s);
  }

  async markAsPaid(t: Transaction): Promise<void> {
    try {
      if (t.recurring_transaction_id) {
        const future = await this.transactionService.getFuturePendingInstallments(
          t.recurring_transaction_id,
          t.reference_month
        );
        
        if (future.length > 0) {
          const ref = this.dialog.open(AmortizationDialogComponent, {
            width: '500px',
            maxWidth: '98vw',
            data: { currentTransaction: t, futureTransactions: future }
          });
          
          ref.afterClosed().subscribe(async (result: any) => {
            if (!result) return;
            try {
              await this.transactionService.updateStatus(t.id, 'paid');
              
              if (result.amortizeCount > 0) {
                const idsToAmortize = future.slice(0, result.amortizeCount).map(f => f.id);
                await this.transactionService.amortizeInstallments(idsToAmortize);
              }
              await this.refreshSummary();
              this.notify.success(result.amortizeCount > 0 
                ? 'Pagamento e amortização realizados com sucesso.' 
                : 'Status atualizado com sucesso.');
            } catch {
              this.notify.error('Não foi possível realizar o pagamento.');
            }
          });
          return;
        }
      }

      await this.transactionService.updateStatus(t.id, 'paid');
      await this.refreshSummary();
      this.notify.success('Status atualizado com sucesso.');
    } catch {
      this.notify.error('Não foi possível atualizar o status.');
    }
  }

  async markAsPending(t: Transaction): Promise<void> {
    try {
      await this.transactionService.updateStatus(t.id, 'pending');
      await this.refreshSummary();
      this.notify.success('Status atualizado com sucesso.');
    } catch {
      this.notify.error('Não foi possível atualizar o status.');
    }
  }

  async duplicate(t: Transaction): Promise<void> {
    try {
      await this.transactionService.duplicateTransaction(t);
      this.notify.success('Movimentação duplicada com sucesso.');
      await this.refreshAfterMutation();
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
        await this.refreshAfterMutation();
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
