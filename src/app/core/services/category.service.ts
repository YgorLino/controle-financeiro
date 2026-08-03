// src/app/core/services/category.service.ts
import { Injectable, inject, signal, computed } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { Category, CategoryFormData } from '../models/category.model';

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);

  private readonly _categories = signal<Category[]>([]);
  private readonly _loading = signal<boolean>(false);

  readonly categories = this._categories.asReadonly();
  readonly loading = this._loading.asReadonly();

  readonly incomeCategories = computed(() =>
    this._categories().filter(c =>
      c.transaction_type === 'income' || c.transaction_type === 'both'
    )
  );

  readonly expenseCategories = computed(() =>
    this._categories().filter(c =>
      c.transaction_type === 'expense' || c.transaction_type === 'both'
    )
  );

  async loadCategories(): Promise<void> {
    this._loading.set(true);
    try {
      const { data, error } = await this.supabase.client
        .from('categories')
        .select('*')
        .order('name');
      if (error) throw error;
      this._categories.set(data ?? []);
    } finally {
      this._loading.set(false);
    }
  }

  async createCategory(formData: CategoryFormData): Promise<Category> {
    const user = this.auth.currentUser();
    if (!user) throw new Error('Não autenticado');

    const { data, error } = await this.supabase.client
      .from('categories')
      .insert({ ...formData, user_id: user.id })
      .select()
      .single();
    if (error) throw error;

    this._categories.update(cats =>
      [...cats, data].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    );
    return data;
  }

  async updateCategory(id: string, formData: Partial<CategoryFormData>): Promise<Category> {
    const { data, error } = await this.supabase.client
      .from('categories')
      .update(formData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    this._categories.update(cats =>
      cats.map(c => c.id === id ? data : c)
    );
    return data;
  }

  async deleteCategory(id: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('categories')
      .delete()
      .eq('id', id);
    if (error) throw error;
    this._categories.update(cats => cats.filter(c => c.id !== id));
  }

  async isCategoryInUse(categoryId: string): Promise<boolean> {
    const { count } = await this.supabase.client
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', categoryId);
    return (count ?? 0) > 0;
  }

  async replaceCategoryInTransactions(oldId: string, newId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('transactions')
      .update({ category_id: newId })
      .eq('category_id', oldId);
    if (error) throw error;
  }

  getCategoryById(id: string | null): Category | undefined {
    if (!id) return undefined;
    return this._categories().find(c => c.id === id);
  }
}
