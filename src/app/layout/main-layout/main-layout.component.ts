// src/app/layout/main-layout/main-layout.component.ts
import {
  Component, ChangeDetectionStrategy, inject, signal,
  HostListener
} from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-main-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, RouterOutlet, RouterLink, RouterLinkActive,
    MatSidenavModule, MatToolbarModule, MatIconModule, MatButtonModule,
    MatListModule, MatMenuModule, MatTooltipModule, MatDividerModule
  ],
  template: `
    <mat-sidenav-container class="layout-container">

      <!-- Sidebar -->
      <mat-sidenav
        #sidenav
        [mode]="isMobile() ? 'over' : 'side'"
        [opened]="!isMobile()"
        class="sidenav">

        <div class="sidenav-header">
          <div class="brand">
            <span class="brand-icon">💰</span>
            <span class="brand-name">Controle Maguinho</span>
          </div>
        </div>

        <nav class="sidenav-nav">
          <mat-nav-list>
            <a
              mat-list-item
              *ngFor="let item of navItems"
              [routerLink]="item.path"
              routerLinkActive="active-link"
              [routerLinkActiveOptions]="{ exact: false }"
              (click)="isMobile() && sidenav.close()">
              <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
              <span matListItemTitle>{{ item.label }}</span>
            </a>
          </mat-nav-list>
        </nav>

        <div class="sidenav-footer">
          <mat-divider />
          <div class="user-info" [matMenuTriggerFor]="userMenu">
            <div class="user-avatar">
              {{ userInitial() }}
            </div>
            <div class="user-details">
              <span class="user-name">{{ userName() }}</span>
              <span class="user-email">{{ userEmail() }}</span>
            </div>
            <mat-icon class="expand-icon">expand_more</mat-icon>
          </div>

          <mat-menu #userMenu="matMenu">
            <button mat-menu-item routerLink="/settings">
              <mat-icon>settings</mat-icon>
              Configurações
            </button>
            <button mat-menu-item (click)="toggleTheme()">
              <mat-icon>{{ isDark() ? 'light_mode' : 'dark_mode' }}</mat-icon>
              {{ isDark() ? 'Modo claro' : 'Modo escuro' }}
            </button>
            <mat-divider />
            <button mat-menu-item (click)="signOut()" class="logout-btn">
              <mat-icon>logout</mat-icon>
              Sair
            </button>
          </mat-menu>
        </div>
      </mat-sidenav>

      <!-- Main content -->
      <mat-sidenav-content class="main-content">
        <!-- Mobile topbar -->
        <mat-toolbar class="mobile-toolbar" *ngIf="isMobile()">
          <button mat-icon-button (click)="sidenav.toggle()">
            <mat-icon>menu</mat-icon>
          </button>
          <span class="toolbar-title">💰 Controle Maguinho</span>
          <span class="spacer"></span>
          <button mat-icon-button (click)="toggleTheme()" matTooltip="Alternar tema">
            <mat-icon>{{ isDark() ? 'light_mode' : 'dark_mode' }}</mat-icon>
          </button>
        </mat-toolbar>

        <div class="page-content">
          <router-outlet />
        </div>
      </mat-sidenav-content>

    </mat-sidenav-container>
  `,
  styles: [`
    .layout-container {
      height: 100vh;
      background: var(--cm-bg);
    }

    .sidenav {
      width: 260px;
      background: var(--cm-surface);
      border-right: 1px solid var(--cm-border);
      display: flex;
      flex-direction: column;
    }

    .sidenav-header {
      padding: 20px 16px 12px;
      border-bottom: 1px solid var(--cm-border);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .brand-icon {
      font-size: 1.5rem;
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #4f46e5, #7c3aed);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .brand-name {
      font-size: 1rem;
      font-weight: 700;
      color: var(--cm-text);
      letter-spacing: -.01em;
    }

    .sidenav-nav {
      flex: 1;
      padding: 12px 8px;
      overflow-y: auto;
    }

    mat-nav-list {
      padding: 0;
    }

    a[mat-list-item] {
      border-radius: 10px !important;
      margin-bottom: 2px;
      height: 44px !important;
      color: var(--cm-text-muted);
      transition: all var(--cm-transition);

      &:hover {
        background: var(--cm-surface-2) !important;
        color: var(--cm-text);
      }

      &.active-link {
        background: var(--cm-primary-light) !important;
        color: var(--cm-primary) !important;
        font-weight: 600;

        mat-icon { color: var(--cm-primary); }
      }
    }

    .sidenav-footer {
      padding: 8px;
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 8px;
      border-radius: 10px;
      cursor: pointer;
      transition: background var(--cm-transition);

      &:hover { background: var(--cm-surface-2); }
    }

    .user-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: linear-gradient(135deg, #4f46e5, #7c3aed);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: .875rem;
      flex-shrink: 0;
    }

    .user-details {
      flex: 1;
      min-width: 0;
    }

    .user-name {
      display: block;
      font-size: .875rem;
      font-weight: 600;
      color: var(--cm-text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .user-email {
      display: block;
      font-size: .75rem;
      color: var(--cm-text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .expand-icon {
      font-size: 18px !important;
      width: 18px !important;
      height: 18px !important;
      color: var(--cm-text-muted);
    }

    .logout-btn { color: var(--cm-warn) !important; }

    .main-content {
      background: var(--cm-bg);
    }

    .mobile-toolbar {
      background: var(--cm-surface);
      border-bottom: 1px solid var(--cm-border);
      box-shadow: var(--cm-shadow);
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .toolbar-title {
      font-weight: 600;
      font-size: 1rem;
    }

    .spacer { flex: 1; }

    .page-content {
      min-height: 100%;
    }
  `]
})
export class MainLayoutComponent {
  private readonly auth = inject(AuthService);
  private readonly themeService = inject(ThemeService);

  readonly isMobile = signal(window.innerWidth < 768);

  readonly navItems: NavItem[] = [
    { path: '/dashboard',    label: 'Dashboard',     icon: 'dashboard' },
    { path: '/transactions', label: 'Movimentações', icon: 'receipt_long' },
    { path: '/categories',   label: 'Categorias',    icon: 'category' },
    { path: '/recurring',    label: 'Recorrências',  icon: 'autorenew' },
    { path: '/settings',     label: 'Configurações', icon: 'settings' }
  ];

  @HostListener('window:resize')
  onResize(): void {
    this.isMobile.set(window.innerWidth < 768);
  }

  userName = () => this.auth.profile()?.name ?? 'Usuário';
  userEmail = () => this.auth.profile()?.email ?? '';
  userInitial = () => (this.auth.profile()?.name ?? 'U').charAt(0).toUpperCase();
  isDark = () => this.themeService.theme() === 'dark';

  toggleTheme(): void {
    this.themeService.setTheme(this.isDark() ? 'light' : 'dark');
  }

  async signOut(): Promise<void> {
    await this.auth.signOut();
  }
}
