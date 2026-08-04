// src/app/core/services/theme.service.ts
import { Injectable, signal, effect, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export type Theme = 'light' | 'dark' | 'system';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly _theme = signal<Theme>(this.getSavedTheme());

  readonly theme = this._theme.asReadonly();

  constructor() {
    effect(() => {
      this.applyTheme(this._theme());
    });
  }

  setTheme(theme: Theme): void {
    localStorage.setItem('cm-theme', theme);
    this._theme.set(theme);
  }

  private getSavedTheme(): Theme {
    return (localStorage.getItem('cm-theme') as Theme) ?? 'light';
  }

  private applyTheme(theme: Theme): void {
    const body = this.document.body;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
    body.classList.toggle('dark-theme', isDark);
    body.classList.toggle('light-theme', !isDark);
  }
}
