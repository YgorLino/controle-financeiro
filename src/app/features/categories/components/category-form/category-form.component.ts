// src/app/features/categories/components/category-form/category-form.component.ts
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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CategoryService } from '../../../../core/services/category.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { Category, CategoryFormData } from '../../../../core/models/category.model';

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981',
  '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#64748b', '#94a3b8'
];

@Component({
  selector: 'app-category-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ReactiveFormsModule, MatDialogModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule
  ],
  template: `
    <div class="form-dialog">
      <h2 mat-dialog-title class="dialog-title">
        <mat-icon>category</mat-icon>
        {{ isEdit ? 'Editar categoria' : 'Nova categoria' }}
      </h2>

      <mat-dialog-content class="dialog-content">
        <form [formGroup]="form" id="category-form">
          <mat-form-field appearance="outline">
            <mat-label>Nome *</mat-label>
            <input matInput formControlName="name" placeholder="Ex: Alimentação, Salário...">
            <mat-error *ngIf="form.get('name')?.hasError('required')">Informe o nome da categoria.</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Tipo *</mat-label>
            <mat-select formControlName="transaction_type">
              <mat-option value="income">Entrada</mat-option>
              <mat-option value="expense">Saída</mat-option>
              <mat-option value="both">Ambos</mat-option>
            </mat-select>
            <mat-error>Selecione o tipo.</mat-error>
          </mat-form-field>

          <!-- Color picker -->
          <div class="color-section">
            <label class="color-label">Cor da categoria</label>
            <div class="color-preview" [style.background]="form.get('color')?.value">
              <span>{{ form.get('name')?.value || 'Categoria' }}</span>
            </div>
            <div class="color-grid">
              <button
                *ngFor="let c of colors"
                type="button"
                class="color-swatch"
                [class.selected]="form.get('color')?.value === c"
                [style.background]="c"
                (click)="selectColor(c)"
                [attr.title]="c">
              </button>
            </div>
          </div>
        </form>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>Cancelar</button>
        <button mat-flat-button color="primary" (click)="onSave()" [disabled]="loading()">
          <mat-spinner *ngIf="loading()" diameter="18"></mat-spinner>
          <mat-icon *ngIf="!loading()">save</mat-icon>
          {{ isEdit ? 'Atualizar' : 'Criar' }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .form-dialog { width: 100%; }
    .dialog-title {
      display: flex; align-items: center; gap: 8px;
      font-size: 1.125rem; font-weight: 600; margin-bottom: 0;
    }
    .dialog-content { min-width: min(420px, 90vw); padding-top: 16px !important; }
    .color-section { margin-top: 8px; }
    .color-label { font-size: .875rem; color: var(--cm-text-muted); margin-bottom: 8px; display: block; }
    .color-preview {
      border-radius: 8px;
      padding: 8px 12px;
      margin-bottom: 12px;
      display: inline-flex;
      align-items: center;
      span { color: white; font-weight: 600; font-size: .875rem; text-shadow: 0 1px 2px rgba(0,0,0,.3); }
    }
    mat-dialog-actions { gap: 8px; padding-top: 8px; }
    mat-dialog-actions button { display: flex; align-items: center; gap: 6px; }
  `]
})
export class CategoryFormComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<CategoryFormComponent>);
  private readonly categoryService = inject(CategoryService);
  private readonly notify = inject(NotificationService);
  private readonly fb = inject(FormBuilder);

  readonly data: { category?: Category } = inject(MAT_DIALOG_DATA) ?? {};
  readonly loading = signal(false);
  readonly colors = PRESET_COLORS;

  get isEdit(): boolean { return !!this.data.category; }

  readonly form = this.fb.group({
    name: ['', [Validators.required]],
    transaction_type: ['expense', Validators.required],
    color: [PRESET_COLORS[0], Validators.required]
  });

  ngOnInit(): void {
    if (this.data.category) {
      this.form.patchValue({
        name: this.data.category.name,
        transaction_type: this.data.category.transaction_type,
        color: this.data.category.color
      });
    }
  }

  selectColor(color: string): void {
    this.form.patchValue({ color });
  }

  async onSave(): Promise<void> {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    try {
      const formData = this.form.value as CategoryFormData;
      if (this.isEdit && this.data.category) {
        await this.categoryService.updateCategory(this.data.category.id, formData);
        this.notify.success('Categoria atualizada com sucesso.');
      } else {
        await this.categoryService.createCategory(formData);
        this.notify.success('Categoria criada com sucesso.');
      }
      this.dialogRef.close(true);
    } catch (err: any) {
      this.notify.error(err?.message ?? 'Não foi possível salvar a categoria.');
    } finally {
      this.loading.set(false);
    }
  }
}
