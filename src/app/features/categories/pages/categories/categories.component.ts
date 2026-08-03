// src/app/features/categories/pages/categories/categories.component.ts
import {
  Component, ChangeDetectionStrategy, OnInit, inject, signal, computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CategoryService } from '../../../../core/services/category.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { Category } from '../../../../core/models/category.model';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { SkeletonLoaderComponent } from '../../../../shared/components/skeleton-loader/skeleton-loader.component';
import { CategoryFormComponent } from '../../components/category-form/category-form.component';

const TYPE_LABELS: Record<string, string> = {
  income: 'Entrada',
  expense: 'Saída',
  both: 'Ambos'
};

@Component({
  selector: 'app-categories',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatButtonModule, MatIconModule, MatDialogModule,
    MatTooltipModule, MatChipsModule, MatSelectModule,
    MatFormFieldModule, MatProgressSpinnerModule,
    ConfirmDialogComponent, EmptyStateComponent, SkeletonLoaderComponent
  ],
  templateUrl: './categories.component.html',
  styleUrl: './categories.component.scss'
})
export class CategoriesComponent implements OnInit {
  readonly categoryService = inject(CategoryService);
  private readonly notify = inject(NotificationService);
  private readonly dialog = inject(MatDialog);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(false);
  readonly typeFilter = this.fb.control('');

  readonly filteredCategories = computed(() => {
    const type = this.typeFilter.value ?? '';
    return this.categoryService.categories().filter(c =>
      !type || c.transaction_type === type
    );
  });

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      await this.categoryService.loadCategories();
    } finally {
      this.loading.set(false);
    }
  }

  openForm(category?: Category): void {
    this.dialog.open(CategoryFormComponent, {
      width: '480px',
      maxWidth: '98vw',
      data: { category }
    });
  }

  confirmDelete(cat: Category): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Excluir categoria',
        message: `Tem certeza que deseja excluir a categoria "${cat.name}"? Os lançamentos associados ficarão sem categoria.`,
        confirmLabel: 'Excluir',
        danger: true
      }
    });
    ref.afterClosed().subscribe(async confirmed => {
      if (!confirmed) return;
      try {
        await this.categoryService.deleteCategory(cat.id);
        this.notify.success('Categoria excluída com sucesso.');
      } catch (err: any) {
        this.notify.error(err?.message ?? 'Não foi possível excluir a categoria.');
      }
    });
  }

  typeLabel(type: string): string {
    return TYPE_LABELS[type] ?? type;
  }
}
