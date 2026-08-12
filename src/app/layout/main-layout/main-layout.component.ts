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

import { AccessService } from '../../core/services/access.service';

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
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss'
})
export class MainLayoutComponent {
  private readonly auth = inject(AuthService);
  private readonly themeService = inject(ThemeService);
  public readonly accessService = inject(AccessService);

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

  // Helper getters for template
  get isTrial() { return this.accessService.isTrial(); }
  
  get trialTimeRemaining() {
    const ms = this.accessService.remainingTimeMs();
    if (ms <= 0) return 'Expirado';
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.max(1, Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60)));
    if (days > 0) return `${days} dias e ${hours} horas`;
    if (hours > 0) return `${hours} horas e ${minutes} minutos`;
    return `${minutes} minutos`;
  }
  
  get isTrialWarning() {
    const ms = this.accessService.remainingTimeMs();
    return ms > 0 && ms <= 24 * 60 * 60 * 1000; // Less than 24h
  }

  toggleTheme(): void {
    this.themeService.setTheme(this.isDark() ? 'light' : 'dark');
  }

  async signOut(): Promise<void> {
    await this.auth.signOut();
  }
}
