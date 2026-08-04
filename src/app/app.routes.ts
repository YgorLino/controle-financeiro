// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: 'auth',
    loadComponent: () => import('./layout/auth-layout/auth-layout.component')
      .then(m => m.AuthLayoutComponent),
    canActivate: [guestGuard],
    children: [
      {
        path: 'login',
        loadComponent: () => import('./features/auth/pages/login/login.component')
          .then(m => m.LoginComponent)
      },
      {
        path: 'register',
        loadComponent: () => import('./features/auth/pages/register/register.component')
          .then(m => m.RegisterComponent)
      },
      {
        path: 'reset-password',
        loadComponent: () => import('./features/auth/pages/reset-password/reset-password.component')
          .then(m => m.ResetPasswordComponent)
      },
      {
        path: '',
        redirectTo: 'login',
        pathMatch: 'full'
      }
    ]
  },
  {
    path: '',
    loadComponent: () => import('./layout/main-layout/main-layout.component')
      .then(m => m.MainLayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/pages/dashboard/dashboard.component')
          .then(m => m.DashboardComponent)
      },
      {
        path: 'transactions',
        loadComponent: () => import('./features/transactions/pages/transactions/transactions.component')
          .then(m => m.TransactionsComponent)
      },
      {
        path: 'categories',
        loadComponent: () => import('./features/categories/pages/categories/categories.component')
          .then(m => m.CategoriesComponent)
      },
      {
        path: 'accounts',
        loadComponent: () => import('./features/accounts/pages/account-list/account-list.component')
          .then(m => m.AccountListComponent)
      },
      {
        path: 'recurring',
        loadComponent: () => import('./features/recurring-transactions/pages/recurring-transactions.component')
          .then(m => m.RecurringTransactionsComponent)
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/settings/pages/settings/settings.component')
          .then(m => m.SettingsComponent)
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
