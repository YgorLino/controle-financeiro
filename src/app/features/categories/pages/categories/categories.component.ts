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
  template: `
    <div class="cm-page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Categorias</h1>
          <p class="page-subtitle">Organize suas movimentações por categoria</p>
        </div>
        <div class="header-actions">
          <!-- Filtro de tipo -->
          <mat-form-field appearance="outline" style="width:180px">
            <mat-label>Tipo</mat-label>
            <mat-select [formControl]="typeFilter">
              <mat-option value="">Todas</mat-option>
              <mat-option value="income">Entrada</mat-option>
              <mat-option value="expense">Saída</mat-option>
              <mat-option value="both">Ambos</mat-option>
            </mat-select>
          </mat-form-field>

          <button mat-flat-button color="primary" (click)="openForm()"
                  id="btn-nova-categoria">
            <mat-icon>add</mat-icon>
            Nova categoria
          </button>
        </div>
      </div>

      <app-skeleton-loader *ngIf="loading()" [count]="6" height="80px"></app-skeleton-loader>

      <div class="categories-grid fade-up" *ngIf="!loading() && filteredCategories().length > 0">
        <div *ngFor="let cat of filteredCategories()" class="category-card">
          <div class="cat-color-bar" [style.background]="cat.color"></div>
          <div class="cat-content">
            <div class="cat-header">
              <div class="cat-avatar" [style.background]="cat.color + '22'" [style.color]="cat.color">
                {{ cat.name.charAt(0).toUpperCase() }}
              </div>
              <div class="cat-info">
                <span class="cat-name">{{ cat.name }}</span>
                <span class="chip" [ngClass]="'chip-' + (cat.transaction_type === 'income' ? 'income' : cat.transaction_type === 'expense' ? 'expense' : '')">
                  {{ typeLabel(cat.transaction_type) }}
                </span>
              </div>
            </div>
            <div class="cat-actions">
              <button mat-icon-button (click)="openForm(cat)" matTooltip="Editar">
                <mat-icon>edit</mat-icon>
              </button>
              <button mat-icon-button color="warn" (click)="confirmDelete(cat)" matTooltip="Excluir">
                <mat-icon>delete</mat-icon>
              </button>
            </div>
          </div>
        </div>
      </div>

      <app-empty-state
        *ngIf="!loading() && filteredCategories().length === 0"
        icon="category"
        title="Nenhuma categoria encontrada"
        message="Crie categorias para organizar suas movimentações financeiras."
        actionLabel="Nova categoria"
        (action)="openForm()">
      </app-empty-state>
    </div>
  `,
  styles: [`
    .page-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      margin-bottom: 24px; flex-wrap: wrap; gap: 16px;
    }
    .page-title { font-size: 1.5rem; font-weight: 700; color: var(--cm-text); margin: 0; }
    .page-subtitle { color: var(--cm-text-muted); font-size: .875rem; margin: 4px 0 0; }
    .header-actions { display: flex; align-items: center; gap: 12px; }

    .categories-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 16px;
    }

    .category-card {
      background: var(--cm-surface);
      border: 1px solid var(--cm-border);
      border-radius: var(--cm-radius);
      box-shadow: var(--cm-shadow);
      overflow: hidden;
      transition: box-shadow var(--cm-transition), transform var(--cm-transition);
      display: flex;
      &:hover { box-shadow: var(--cm-shadow-md); transform: translateY(-2px); }
    }

    .cat-color-bar { width: 6px; flex-shrink: 0; }

    .cat-content {
      flex: 1;
      padding: 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .cat-header { display: flex; align-items: center; gap: 12px; }

    .cat-avatar {
      width: 40px; height: 40px;
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 1rem;
    }

    .cat-info { display: flex; flex-direction: column; gap: 4px; }
    .cat-name { font-weight: 600; font-size: .9375rem; color: var(--cm-text); }

    .cat-actions { display: flex; gap: 4px; }
  `]
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
