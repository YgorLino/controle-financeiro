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
  templateUrl: './transaction-form.component.html',
  styleUrl: './transaction-form.component.scss'
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
