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

const PRESET_ICONS = [
  'attach_money', 'restaurant', 'home', 'directions_car', 'local_hospital',
  'sports_esports', 'shopping_cart', 'school', 'pets', 'flight',
  'work', 'fitness_center', 'directions_bus', 'movie', 'local_cafe', 'category'
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
  templateUrl: './category-form.component.html',
  styleUrl: './category-form.component.scss'
})
export class CategoryFormComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<CategoryFormComponent>);
  private readonly categoryService = inject(CategoryService);
  private readonly notify = inject(NotificationService);
  private readonly fb = inject(FormBuilder);

  readonly data: { category?: Category } = inject(MAT_DIALOG_DATA) ?? {};
  readonly loading = signal(false);
  readonly colors = PRESET_COLORS;
  readonly icons = PRESET_ICONS;

  get isEdit(): boolean { return !!this.data.category; }

  readonly form = this.fb.group({
    name: ['', [Validators.required]],
    transaction_type: ['expense', Validators.required],
    color: [PRESET_COLORS[0], Validators.required],
    icon: [PRESET_ICONS[0], Validators.required]
  });

  ngOnInit(): void {
    if (this.data.category) {
      this.form.patchValue({
        name: this.data.category.name,
        transaction_type: this.data.category.transaction_type,
        color: this.data.category.color,
        icon: this.data.category.icon
      });
    }
  }

  selectColor(color: string): void {
    this.form.patchValue({ color });
  }

  selectIcon(icon: string): void {
    this.form.patchValue({ icon });
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
