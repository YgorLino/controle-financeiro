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
  template: `
    <div class="cm-page">
      <!-- Header -->
      <div class="page-header">
        <div>
          <h1 class="page-title">Recorrências</h1>
          <p class="page-subtitle">Gerencie seus lançamentos recorrentes</p>
        </div>
        <div class="header-actions">
          <app-month-selector
            [currentDate]="currentMonthDate()"
            (monthChanged)="onMonthChanged($event)">
          </app-month-selector>

          <button mat-flat-button (click)="generateForMonth()"
                  [disabled]="generating()"
                  class="generate-btn"
                  id="btn-gerar-recorrencias">
            <mat-spinner *ngIf="generating()" diameter="18"></mat-spinner>
            <mat-icon *ngIf="!generating()">autorenew</mat-icon>
            Gerar para este mês
          </button>

          <button mat-flat-button color="primary" (click)="openForm()"
                  id="btn-nova-recorrencia">
            <mat-icon>add</mat-icon>
            Nova recorrência
          </button>
        </div>
      </div>

      <!-- Skeleton -->
      <app-skeleton-loader *ngIf="loading()" [count]="4" height="100px"></app-skeleton-loader>

      <!-- Cards -->
      <div class="recurring-grid fade-up" *ngIf="!loading() && recurring().length > 0">
        <div *ngFor="let r of recurring()" class="recurring-card"
             [class.inactive]="!r.is_active">
          <div class="card-header">
            <div class="card-icon"
                 [style.background]="r.transaction_type === 'income' ? 'rgba(16,185,129,.12)' : 'rgba(239,68,68,.12)'"
                 [style.color]="r.transaction_type === 'income' ? 'var(--cm-income)' : 'var(--cm-expense)'">
              <mat-icon>{{ r.transaction_type === 'income' ? 'trending_up' : 'trending_down' }}</mat-icon>
            </div>
            <div class="card-info">
              <span class="card-title">{{ r.description }}</span>
              <div class="card-chips">
                <span class="chip" [ngClass]="r.transaction_type === 'income' ? 'chip-income' : 'chip-expense'">
                  {{ r.transaction_type === 'income' ? 'Entrada' : 'Saída' }}
                </span>
                <span class="chip chip-pending">{{ freqLabel(r.frequency) }}</span>
                <span *ngIf="!r.is_active" class="chip chip-cancelled">Inativa</span>
              </div>
            </div>
            <div class="card-amount"
                 [class.income-amount]="r.transaction_type === 'income'"
                 [class.expense-amount]="r.transaction_type === 'expense'">
              {{ r.amount | currencyBr }}
            </div>
          </div>

          <mat-divider style="margin: 12px 0"></mat-divider>

          <div class="card-details">
            <div class="detail-item">
              <mat-icon>event</mat-icon>
              <span>Vencimento: dia {{ r.due_day }}</span>
            </div>
            <div class="detail-item" *ngIf="r.category">
              <span class="cat-dot" [style.background]="$any(r.category)?.color"></span>
              <span>{{ $any(r.category)?.name }}</span>
            </div>
            <div class="detail-item">
              <mat-icon>date_range</mat-icon>
              <span>Desde {{ formatDate(r.start_date) }}</span>
            </div>
            <div class="detail-item" *ngIf="r.end_date">
              <mat-icon>event_busy</mat-icon>
              <span>Até {{ formatDate(r.end_date) }}</span>
            </div>
          </div>

          <div class="card-actions">
            <mat-slide-toggle
              [checked]="r.is_active"
              (change)="toggleActive(r, $event.checked)"
              color="primary"
              [matTooltip]="r.is_active ? 'Desativar recorrência' : 'Ativar recorrência'">
              {{ r.is_active ? 'Ativa' : 'Inativa' }}
            </mat-slide-toggle>

            <div class="action-btns">
              <button mat-icon-button (click)="openForm(r)" matTooltip="Editar">
                <mat-icon>edit</mat-icon>
              </button>
              <button mat-icon-button color="warn" (click)="confirmDelete(r)" matTooltip="Excluir">
                <mat-icon>delete</mat-icon>
              </button>
            </div>
          </div>
        </div>
      </div>

      <app-empty-state
        *ngIf="!loading() && recurring().length === 0"
        icon="autorenew"
        title="Nenhuma recorrência cadastrada"
        message="Cadastre despesas ou receitas que se repetem todo mês, como salário, aluguel, assinaturas, etc."
        actionLabel="Nova recorrência"
        (action)="openForm()">
      </app-empty-state>

      <!-- Modal de formulário (inline) -->
      <div class="form-overlay" *ngIf="showFormDialog()" (click)="closeForm()"></div>
      <div class="form-panel cm-card" *ngIf="showFormDialog()" (click)="$event.stopPropagation()">
        <h2 class="cm-section-title">
          <mat-icon>{{ editingRecurring() ? 'edit' : 'add_circle' }}</mat-icon>
          {{ editingRecurring() ? 'Editar recorrência' : 'Nova recorrência' }}
        </h2>

        <form [formGroup]="form" class="recurring-form">
          <div class="cm-form-row">
            <mat-form-field appearance="outline">
              <mat-label>Tipo *</mat-label>
              <mat-select formControlName="transaction_type">
                <mat-option value="income">Entrada</mat-option>
                <mat-option value="expense">Saída</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Frequência *</mat-label>
              <mat-select formControlName="frequency">
                <mat-option value="monthly">Mensal</mat-option>
                <mat-option value="weekly">Semanal</mat-option>
                <mat-option value="yearly">Anual</mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <mat-form-field appearance="outline">
            <mat-label>Descrição *</mat-label>
            <input matInput formControlName="description" placeholder="Ex: Salário, Aluguel...">
            <mat-error>Informe uma descrição.</mat-error>
          </mat-form-field>

          <div class="cm-form-row">
            <mat-form-field appearance="outline">
              <mat-label>Valor *</mat-label>
              <span matPrefix>R$&nbsp;</span>
              <input matInput type="number" formControlName="amount" min="0.01" step="0.01">
              <mat-error>Informe um valor válido.</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Dia de vencimento *</mat-label>
              <input matInput type="number" formControlName="due_day" min="1" max="28">
              <mat-hint>1–28</mat-hint>
              <mat-error>Informe o dia (1-28).</mat-error>
            </mat-form-field>
          </div>

          <div class="cm-form-row">
            <mat-form-field appearance="outline">
              <mat-label>Categoria</mat-label>
              <mat-select formControlName="category_id">
                <mat-option value="">Sem categoria</mat-option>
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
              <mat-label>Data de início *</mat-label>
              <input matInput [matDatepicker]="startPicker" formControlName="start_date_obj">
              <mat-datepicker-toggle matIconSuffix [for]="startPicker"></mat-datepicker-toggle>
              <mat-datepicker #startPicker></mat-datepicker>
              <mat-error>Informe a data de início.</mat-error>
            </mat-form-field>
          </div>

          <mat-form-field appearance="outline">
            <mat-label>Data de término (opcional)</mat-label>
            <input matInput [matDatepicker]="endPicker" formControlName="end_date_obj">
            <mat-datepicker-toggle matIconSuffix [for]="endPicker"></mat-datepicker-toggle>
            <mat-datepicker #endPicker></mat-datepicker>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Observação</mat-label>
            <textarea matInput formControlName="notes" rows="2"></textarea>
          </mat-form-field>
        </form>

        <div class="form-actions">
          <button mat-button (click)="closeForm()">Cancelar</button>
          <button mat-flat-button color="primary" (click)="onSave()" [disabled]="formLoading()">
            <mat-spinner *ngIf="formLoading()" diameter="18"></mat-spinner>
            <mat-icon *ngIf="!formLoading()">save</mat-icon>
            {{ editingRecurring() ? 'Atualizar' : 'Criar' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      margin-bottom: 24px; flex-wrap: wrap; gap: 16px;
    }
    .page-title { font-size: 1.5rem; font-weight: 700; color: var(--cm-text); margin: 0; }
    .page-subtitle { color: var(--cm-text-muted); font-size: .875rem; margin: 4px 0 0; }
    .header-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .generate-btn { display: flex; align-items: center; gap: 6px; }

    .recurring-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 16px;
    }

    .recurring-card {
      background: var(--cm-surface);
      border: 1px solid var(--cm-border);
      border-radius: var(--cm-radius);
      padding: 20px;
      box-shadow: var(--cm-shadow);
      transition: box-shadow var(--cm-transition);
      &:hover { box-shadow: var(--cm-shadow-md); }
      &.inactive { opacity: .6; }
    }

    .card-header {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }

    .card-icon {
      width: 44px; height: 44px;
      border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      mat-icon { font-size: 22px; width: 22px; height: 22px; }
    }

    .card-info { flex: 1; min-width: 0; }
    .card-title { font-weight: 600; font-size: .9375rem; color: var(--cm-text); display: block; margin-bottom: 6px; }
    .card-chips { display: flex; gap: 6px; flex-wrap: wrap; }
    .card-amount { font-weight: 700; font-size: 1.125rem; white-space: nowrap; }
    .income-amount { color: var(--cm-income); }
    .expense-amount { color: var(--cm-expense); }

    .card-details {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 20px;
      margin-bottom: 12px;
    }

    .detail-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: .8125rem;
      color: var(--cm-text-muted);
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
    }

    .cat-dot {
      width: 10px; height: 10px;
      border-radius: 50%;
      display: inline-block;
    }

    .card-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .action-btns { display: flex; gap: 4px; }

    /* Form panel (slide-in overlay) */
    .form-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,.3);
      backdrop-filter: blur(2px);
      z-index: 999;
    }

    .form-panel {
      position: fixed;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      z-index: 1000;
      width: min(580px, 95vw);
      max-height: 90vh;
      overflow-y: auto;
      animation: fade-up 200ms ease-out;
    }

    .recurring-form {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: 16px;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 8px;
    }

    .form-actions button { display: flex; align-items: center; gap: 6px; }
  `]
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
