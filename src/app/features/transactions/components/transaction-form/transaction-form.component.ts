// src/app/features/transactions/components/transaction-form/transaction-form.component.ts
import {
  Component, ChangeDetectionStrategy, inject, signal, OnInit, Inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { TransactionService } from '../../../../core/services/transaction.service';
import { CategoryService } from '../../../../core/services/category.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { Transaction, TransactionStatus, TransactionType } from '../../../../core/models/transaction.model';
import { Category } from '../../../../core/models/category.model';
import { format, startOfMonth } from 'date-fns';

export interface TransactionFormDialogData {
  transaction?: Transaction;
  defaultType?: TransactionType;
  defaultMonth?: string;
}

@Component({
  selector: 'app-transaction-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ReactiveFormsModule, MatDialogModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatDatepickerModule,
    MatNativeDateModule, MatProgressSpinnerModule,
    MatCheckboxModule, MatChipsModule, MatDividerModule
  ],
  template: `
    <div class="form-dialog">
      <h2 mat-dialog-title class="dialog-title">
        <mat-icon>{{ isEdit ? 'edit' : 'add_circle' }}</mat-icon>
        {{ isEdit ? 'Editar movimentação' : 'Nova movimentação' }}
      </h2>

      <mat-dialog-content class="dialog-content">
        <form [formGroup]="form" (ngSubmit)="onSave()" id="transaction-form">

          <!-- Tipo -->
          <mat-form-field appearance="outline">
            <mat-label>Tipo *</mat-label>
            <mat-select formControlName="transaction_type" (selectionChange)="onTypeChange()">
              <mat-option value="income">
                <span class="chip chip-income">↑ Entrada</span>
              </mat-option>
              <mat-option value="expense">
                <span class="chip chip-expense">↓ Saída</span>
              </mat-option>
            </mat-select>
            <mat-error>Selecione o tipo da movimentação.</mat-error>
          </mat-form-field>

          <!-- Descrição -->
          <mat-form-field appearance="outline">
            <mat-label>Descrição *</mat-label>
            <input matInput formControlName="description" placeholder="Ex: Salário, Conta de luz...">
            <mat-icon matSuffix>description</mat-icon>
            <mat-error *ngIf="form.get('description')?.hasError('required')">Informe uma descrição.</mat-error>
          </mat-form-field>

          <div class="cm-form-row">
            <!-- Valor -->
            <mat-form-field appearance="outline">
              <mat-label>Valor *</mat-label>
              <span matPrefix>R$&nbsp;</span>
              <input matInput type="number" formControlName="amount"
                     min="0.01" step="0.01" placeholder="0,00">
              <mat-error *ngIf="form.get('amount')?.hasError('required')">Informe um valor válido.</mat-error>
              <mat-error *ngIf="form.get('amount')?.hasError('min')">O valor deve ser maior que zero.</mat-error>
            </mat-form-field>

            <!-- Categoria -->
            <mat-form-field appearance="outline">
              <mat-label>Categoria *</mat-label>
              <mat-select formControlName="category_id">
                <mat-option *ngFor="let cat of availableCategories()" [value]="cat.id">
                  <div class="cat-option">
                    <span class="cat-dot" [style.background]="cat.color"></span>
                    {{ cat.name }}
                  </div>
                </mat-option>
              </mat-select>
              <mat-error>Selecione uma categoria.</mat-error>
            </mat-form-field>
          </div>

          <div class="cm-form-row">
            <!-- Mês de referência -->
            <mat-form-field appearance="outline">
              <mat-label>Mês de referência *</mat-label>
              <input matInput [matDatepicker]="refPicker" formControlName="reference_month_date"
                     placeholder="MM/AAAA" readonly>
              <mat-datepicker-toggle matIconSuffix [for]="refPicker"></mat-datepicker-toggle>
              <mat-datepicker #refPicker startView="year"
                (monthSelected)="onMonthSelected($event, refPicker)">
              </mat-datepicker>
              <mat-error>Selecione o mês de referência.</mat-error>
            </mat-form-field>

            <!-- Data de vencimento -->
            <mat-form-field appearance="outline">
              <mat-label>Vencimento</mat-label>
              <input matInput [matDatepicker]="duePicker" formControlName="due_date_obj"
                     placeholder="dd/MM/aaaa">
              <mat-datepicker-toggle matIconSuffix [for]="duePicker"></mat-datepicker-toggle>
              <mat-datepicker #duePicker></mat-datepicker>
            </mat-form-field>
          </div>

          <div class="cm-form-row">
            <!-- Status -->
            <mat-form-field appearance="outline">
              <mat-label>Status *</mat-label>
              <mat-select formControlName="status" (selectionChange)="onStatusChange()">
                <mat-option *ngIf="form.get('transaction_type')?.value === 'income'" value="paid">
                  <span class="chip chip-paid">Recebido</span>
                </mat-option>
                <mat-option *ngIf="form.get('transaction_type')?.value === 'income'" value="pending">
                  <span class="chip chip-pending">A receber</span>
                </mat-option>
                <mat-option *ngIf="form.get('transaction_type')?.value !== 'income'" value="paid">
                  <span class="chip chip-paid">Pago</span>
                </mat-option>
                <mat-option *ngIf="form.get('transaction_type')?.value !== 'income'" value="pending">
                  <span class="chip chip-pending">Pendente</span>
                </mat-option>
                <mat-option value="overdue">
                  <span class="chip chip-overdue">Atrasado</span>
                </mat-option>
                <mat-option value="cancelled">
                  <span class="chip chip-cancelled">Cancelado</span>
                </mat-option>
              </mat-select>
              <mat-error>Selecione o status.</mat-error>
            </mat-form-field>

            <!-- Data de pagamento (se pago) -->
            <mat-form-field appearance="outline" *ngIf="showPaymentDate()">
              <mat-label>Data do pagamento</mat-label>
              <input matInput [matDatepicker]="payPicker" formControlName="payment_date_obj"
                     placeholder="dd/MM/aaaa">
              <mat-datepicker-toggle matIconSuffix [for]="payPicker"></mat-datepicker-toggle>
              <mat-datepicker #payPicker></mat-datepicker>
            </mat-form-field>
          </div>

          <!-- Observação -->
          <mat-form-field appearance="outline">
            <mat-label>Observação</mat-label>
            <textarea matInput formControlName="notes" rows="2"
                      placeholder="Informações adicionais..."></textarea>
          </mat-form-field>

        </form>
      </mat-dialog-content>

      <mat-dialog-actions align="end" class="dialog-actions">
        <button mat-button mat-dialog-close [disabled]="loading()">Cancelar</button>
        <button mat-flat-button color="primary"
                (click)="onSave()" [disabled]="loading()">
          <mat-spinner *ngIf="loading()" diameter="18"></mat-spinner>
          <span *ngIf="!loading()">
            <mat-icon>save</mat-icon>
            {{ isEdit ? 'Atualizar' : 'Salvar' }}
          </span>
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .form-dialog { width: 100%; }

    .dialog-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--cm-text);
      padding-bottom: 8px;
    }

    .dialog-content {
      padding: 16px 0 8px !important;
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: min(500px, 90vw);
      max-height: 70vh;
    }

    .dialog-actions {
      padding-top: 8px;
      gap: 8px;
    }

    .dialog-actions button {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .cat-option {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .cat-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      flex-shrink: 0;
    }
  `]
})
export class TransactionFormComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<TransactionFormComponent>);
  private readonly transactionService = inject(TransactionService);
  private readonly categoryService = inject(CategoryService);
  private readonly notify = inject(NotificationService);
  private readonly fb = inject(FormBuilder);

  readonly data: TransactionFormDialogData = inject(MAT_DIALOG_DATA) ?? {};

  readonly loading = signal(false);
  readonly showPaymentDate = signal(false);
  readonly availableCategories = signal<Category[]>([]);

  get isEdit(): boolean {
    return !!this.data.transaction;
  }

  readonly form = this.fb.group({
    transaction_type: [this.data.defaultType ?? 'expense', Validators.required],
    description: ['', [Validators.required, Validators.minLength(1)]],
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    category_id: [null as string | null, Validators.required],
    reference_month_date: [null as Date | null, Validators.required],
    due_date_obj: [null as Date | null],
    status: ['pending' as TransactionStatus, Validators.required],
    payment_date_obj: [null as Date | null],
    notes: ['']
  });

  async ngOnInit(): Promise<void> {
    await this.categoryService.loadCategories();
    this.updateAvailableCategories();

    if (this.data.transaction) {
      const t = this.data.transaction;
      this.form.patchValue({
        transaction_type: t.transaction_type,
        description: t.description,
        amount: t.amount,
        category_id: t.category_id,
        reference_month_date: t.reference_month ? new Date(t.reference_month + 'T12:00:00') : null,
        due_date_obj: t.due_date ? new Date(t.due_date + 'T12:00:00') : null,
        status: t.status,
        payment_date_obj: t.payment_date ? new Date(t.payment_date + 'T12:00:00') : null,
        notes: t.notes ?? ''
      });
      this.updateAvailableCategories();
      this.showPaymentDate.set(t.status === 'paid');
    } else if (this.data.defaultMonth) {
      this.form.patchValue({
        reference_month_date: new Date(this.data.defaultMonth + 'T12:00:00')
      });
    } else {
      this.form.patchValue({
        reference_month_date: startOfMonth(new Date())
      });
    }
  }

  onTypeChange(): void {
    this.form.patchValue({ category_id: null });
    this.updateAvailableCategories();
  }

  onStatusChange(): void {
    const status = this.form.get('status')?.value;
    this.showPaymentDate.set(status === 'paid');
    if (status === 'paid' && !this.form.get('payment_date_obj')?.value) {
      this.form.patchValue({ payment_date_obj: new Date() });
    }
  }

  onMonthSelected(event: Date, picker: any): void {
    const d = startOfMonth(event);
    this.form.patchValue({ reference_month_date: d });
    picker.close();
  }

  private updateAvailableCategories(): void {
    const type = this.form.get('transaction_type')?.value;
    if (type === 'income') {
      this.availableCategories.set(this.categoryService.incomeCategories());
    } else if (type === 'expense') {
      this.availableCategories.set(this.categoryService.expenseCategories());
    } else {
      this.availableCategories.set(this.categoryService.categories());
    }
  }

  async onSave(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    try {
      const v = this.form.value;
      const refDate = v.reference_month_date as Date;
      const referenceMonth = format(startOfMonth(refDate), 'yyyy-MM-01');
      const dueDate = v.due_date_obj ? format(v.due_date_obj as Date, 'yyyy-MM-dd') : null;
      const paymentDate = v.payment_date_obj ? format(v.payment_date_obj as Date, 'yyyy-MM-dd') : null;

      const payload = {
        description: v.description as string,
        transaction_type: v.transaction_type as 'income' | 'expense',
        amount: Number(v.amount),
        category_id: v.category_id as string,
        reference_month: referenceMonth,
        due_date: dueDate,
        status: v.status as TransactionStatus,
        payment_date: paymentDate,
        notes: v.notes || null,
        is_recurring: false
      };

      if (this.isEdit && this.data.transaction) {
        await this.transactionService.updateTransaction(this.data.transaction.id, payload);
        this.notify.success('Movimentação atualizada com sucesso.');
      } else {
        await this.transactionService.createTransaction(payload);
        this.notify.success('Movimentação cadastrada com sucesso.');
      }

      this.dialogRef.close(true);
    } catch (err: any) {
      this.notify.error(err?.message ?? 'Não foi possível salvar a movimentação.');
    } finally {
      this.loading.set(false);
    }
  }
}
