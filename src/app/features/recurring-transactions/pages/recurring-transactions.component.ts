// src/app/features/recurring-transactions/pages/recurring-transactions.component.ts
import {
  Component, ChangeDetectionStrategy, OnInit, inject,
  signal, computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { RecurringTransactionService } from '../../../core/services/recurring-transaction.service';
import { TransactionService } from '../../../core/services/transaction.service';
import { CategoryService } from '../../../core/services/category.service';
import { NotificationService } from '../../../core/services/notification.service';
import { RecurringTransaction, RecurringFormData, RecurringFrequency } from '../../../core/models/recurring-transaction.model';
import { TransactionType } from '../../../core/models/transaction.model';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { SkeletonLoaderComponent } from '../../../shared/components/skeleton-loader/skeleton-loader.component';
import { CurrencyBrPipe } from '../../../shared/pipes/currency-br.pipe';
import { MonthSelectorComponent } from '../../../shared/components/month-selector/month-selector.component';
import { format, startOfMonth } from 'date-fns';

const FREQ_LABELS: Record<string, string> = {
  monthly: 'Mensal',
  weekly: 'Semanal',
  yearly: 'Anual'
};

@Component({
  selector: 'app-recurring-transactions',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatButtonModule, MatIconModule, MatDialogModule,
    MatTooltipModule, MatChipsModule, MatDividerModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatProgressSpinnerModule, MatDatepickerModule,
    MatNativeDateModule, MatSlideToggleModule,
    EmptyStateComponent, SkeletonLoaderComponent, CurrencyBrPipe,
    MonthSelectorComponent
  ],
  templateUrl: './recurring-transactions.component.html',
  styleUrl: './recurring-transactions.component.scss'
})
export class RecurringTransactionsComponent implements OnInit {
  readonly recurringService = inject(RecurringTransactionService);
  readonly categoryService = inject(CategoryService);
  private readonly transactionService = inject(TransactionService);
  private readonly notify = inject(NotificationService);
  private readonly dialog = inject(MatDialog);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(false);
  readonly generating = signal(false);
  readonly formLoading = signal(false);
  readonly showFormDialog = signal(false);
  readonly editingRecurring = signal<RecurringTransaction | null>(null);
  readonly currentMonthDate = signal(startOfMonth(new Date()));

  readonly recurring = this.recurringService.recurring;

  readonly form = this.fb.group({
    transaction_type: ['expense' as TransactionType, Validators.required],
    frequency: ['monthly' as RecurringFrequency, Validators.required],
    description: ['', Validators.required],
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    due_day: [1, [Validators.required, Validators.min(1), Validators.max(28)]],
    category_id: [''],
    start_date_obj: [new Date(), Validators.required],
    end_date_obj: [null as Date | null],
    notes: ['']
  });

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      await Promise.all([
        this.recurringService.loadRecurring(),
        this.categoryService.loadCategories()
      ]);
    } finally {
      this.loading.set(false);
    }
  }

  onMonthChanged(date: Date): void {
    this.currentMonthDate.set(date);
  }

  openForm(recurring?: RecurringTransaction): void {
    this.editingRecurring.set(recurring ?? null);
    if (recurring) {
      this.form.patchValue({
        transaction_type: recurring.transaction_type,
        frequency: recurring.frequency,
        description: recurring.description,
        amount: recurring.amount,
        due_day: recurring.due_day,
        category_id: recurring.category_id ?? '',
        start_date_obj: new Date(recurring.start_date + 'T12:00:00'),
        end_date_obj: recurring.end_date ? new Date(recurring.end_date + 'T12:00:00') : null,
        notes: recurring.notes ?? ''
      });
    } else {
      this.form.reset({
        transaction_type: 'expense',
        frequency: 'monthly',
        due_day: 1,
        start_date_obj: new Date()
      });
    }
    this.showFormDialog.set(true);
  }

  closeForm(): void {
    this.showFormDialog.set(false);
    this.editingRecurring.set(null);
  }

  async onSave(): Promise<void> {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.formLoading.set(true);
    try {
      const v = this.form.value;
      const payload: RecurringFormData = {
        transaction_type: v.transaction_type as TransactionType,
        frequency: v.frequency as RecurringFrequency,
        description: v.description!,
        amount: Number(v.amount),
        due_day: Number(v.due_day),
        category_id: v.category_id || null,
        start_date: format(v.start_date_obj as Date, 'yyyy-MM-dd'),
        end_date: v.end_date_obj ? format(v.end_date_obj as Date, 'yyyy-MM-dd') : null,
        notes: v.notes || null
      };

      const editing = this.editingRecurring();
      if (editing) {
        await this.recurringService.update(editing.id, payload);
        this.notify.success('Recorrência atualizada com sucesso.');
      } else {
        await this.recurringService.create(payload);
        this.notify.success('Recorrência criada com sucesso.');
      }
      this.closeForm();
    } catch (err: any) {
      this.notify.error(err?.message ?? 'Não foi possível salvar a recorrência.');
    } finally {
      this.formLoading.set(false);
    }
  }

  async toggleActive(r: RecurringTransaction, isActive: boolean): Promise<void> {
    try {
      await this.recurringService.toggleActive(r.id, isActive);
      this.notify.success(`Recorrência ${isActive ? 'ativada' : 'desativada'}.`);
    } catch {
      this.notify.error('Não foi possível alterar o status da recorrência.');
    }
  }

  confirmDelete(r: RecurringTransaction): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Excluir recorrência',
        message: `Deseja excluir a recorrência "${r.description}"? Os lançamentos já gerados não serão afetados.`,
        confirmLabel: 'Excluir',
        danger: true
      }
    });
    ref.afterClosed().subscribe(async confirmed => {
      if (!confirmed) return;
      try {
        await this.recurringService.delete(r.id);
        this.notify.success('Recorrência excluída com sucesso.');
      } catch {
        this.notify.error('Não foi possível excluir a recorrência.');
      }
    });
  }

  async generateForMonth(): Promise<void> {
    this.generating.set(true);
    try {
      const monthStr = format(startOfMonth(this.currentMonthDate()), 'yyyy-MM-01');
      const count = await this.recurringService.generateForMonth(monthStr);
      if (count > 0) {
        this.notify.success(`${count} lançamento(s) gerado(s) com sucesso para o mês!`);
      } else {
        this.notify.info('Todos os lançamentos deste mês já foram gerados.');
      }
    } catch {
      this.notify.error('Não foi possível gerar os lançamentos.');
    } finally {
      this.generating.set(false);
    }
  }

  freqLabel(freq: string): string {
    return FREQ_LABELS[freq] ?? freq;
  }

  formatDate(date: string | null): string {
    if (!date) return '—';
    return new Date(date + 'T12:00:00').toLocaleDateString('pt-BR');
  }
}
