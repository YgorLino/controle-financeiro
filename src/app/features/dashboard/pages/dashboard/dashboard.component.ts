// src/app/features/dashboard/pages/dashboard/dashboard.component.ts
import {
  Component, ChangeDetectionStrategy, OnInit, inject,
  signal, computed, effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import {
  Chart, ArcElement, BarElement, LineElement, PointElement,
  CategoryScale, LinearScale, Tooltip, Legend, Filler,
  BarController, LineController, DoughnutController
} from 'chart.js';
import { TransactionService } from '../../../../core/services/transaction.service';
import { CategoryService } from '../../../../core/services/category.service';
import { DashboardSummary, Transaction } from '../../../../core/models/transaction.model';
import { MonthSelectorComponent } from '../../../../shared/components/month-selector/month-selector.component';
import { SkeletonLoaderComponent } from '../../../../shared/components/skeleton-loader/skeleton-loader.component';
import { CurrencyBrPipe } from '../../../../shared/pipes/currency-br.pipe';
import { startOfMonth, subMonths, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Registrar Chart.js
Chart.register(
  ArcElement, BarElement, LineElement, PointElement,
  CategoryScale, LinearScale, Tooltip, Legend, Filler,
  BarController, LineController, DoughnutController
);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, RouterLink,
    MatCardModule, MatIconModule, MatButtonModule,
    MatDividerModule, MatProgressBarModule, MatTooltipModule,
    BaseChartDirective,
    MonthSelectorComponent, SkeletonLoaderComponent, CurrencyBrPipe
  ],
  template: `
    <div class="cm-page">
      <!-- Header -->
      <div class="page-header">
        <div>
          <h1 class="page-title">Dashboard</h1>
          <p class="page-subtitle">Visão geral do mês</p>
        </div>
        <app-month-selector
          [currentDate]="currentMonthDate()"
          (monthChanged)="onMonthChanged($event)">
        </app-month-selector>
      </div>

      <!-- Skeleton loading -->
      <ng-container *ngIf="loading()">
        <app-skeleton-loader [count]="4" height="120px" gap="16px"></app-skeleton-loader>
        <div style="height: 16px"></div>
        <app-skeleton-loader [count]="2" height="300px" gap="16px"></app-skeleton-loader>
      </ng-container>

      <!-- Cards de resumo -->
      <ng-container *ngIf="!loading()">
        <div class="summary-grid fade-up">

          <div class="summary-card income">
            <div class="card-icon">
              <mat-icon>trending_up</mat-icon>
            </div>
            <div class="card-info">
              <span class="card-label">Total de Entradas</span>
              <span class="card-value income-value">{{ summary()?.total_income | currencyBr }}</span>
              <span class="card-sub">{{ summary()?.total_income_count }} lançamentos</span>
            </div>
          </div>

          <div class="summary-card expense">
            <div class="card-icon">
              <mat-icon>trending_down</mat-icon>
            </div>
            <div class="card-info">
              <span class="card-label">Total de Saídas</span>
              <span class="card-value expense-value">{{ summary()?.total_expense | currencyBr }}</span>
              <span class="card-sub">{{ summary()?.total_expense_count }} lançamentos</span>
            </div>
          </div>

          <div class="summary-card balance" [class.positive]="(summary()?.balance ?? 0) >= 0" [class.negative]="(summary()?.balance ?? 0) < 0">
            <div class="card-icon">
              <mat-icon>account_balance_wallet</mat-icon>
            </div>
            <div class="card-info">
              <span class="card-label">Saldo do Mês</span>
              <span class="card-value" [class.income-value]="(summary()?.balance ?? 0) >= 0" [class.expense-value]="(summary()?.balance ?? 0) < 0">
                {{ summary()?.balance | currencyBr }}
              </span>
              <span class="card-sub">Entradas − Saídas</span>
            </div>
          </div>

          <div class="summary-card pending">
            <div class="card-icon">
              <mat-icon>pending_actions</mat-icon>
            </div>
            <div class="card-info">
              <span class="card-label">Pendente</span>
              <span class="card-value pending-value">{{ summary()?.total_pending | currencyBr }}</span>
              <span class="card-sub">{{ summary()?.pending_count }} conta(s) em aberto</span>
            </div>
          </div>

          <div class="summary-card paid">
            <div class="card-icon">
              <mat-icon>check_circle</mat-icon>
            </div>
            <div class="card-info">
              <span class="card-label">Já Pago</span>
              <span class="card-value paid-value">{{ summary()?.total_paid | currencyBr }}</span>
              <span class="card-sub">de {{ summary()?.total_expense | currencyBr }}</span>
            </div>
          </div>

          <div class="summary-card overdue" *ngIf="(summary()?.overdue_count ?? 0) > 0">
            <div class="card-icon warn">
              <mat-icon>warning</mat-icon>
            </div>
            <div class="card-info">
              <span class="card-label">Atrasado(s)</span>
              <span class="card-value overdue-value">{{ summary()?.overdue_count }}</span>
              <span class="card-sub overdue-sub">Requer atenção imediata</span>
            </div>
          </div>
        </div>

        <!-- Barra de progresso -->
        <div class="cm-card progress-section fade-up">
          <div class="progress-header">
            <span>Renda comprometida</span>
            <span class="progress-pct" [class.danger]="commitedPct() > 80">
              {{ commitedPct() }}%
            </span>
          </div>
          <mat-progress-bar
            mode="determinate"
            [value]="commitedPct()"
            [color]="commitedPct() > 80 ? 'warn' : 'primary'">
          </mat-progress-bar>
          <p class="progress-hint">
            {{ summary()?.total_expense | currencyBr }} de {{ summary()?.total_income | currencyBr }} em entradas
          </p>
        </div>

        <!-- Gráficos -->
        <div class="charts-grid fade-up">

          <div class="cm-card chart-card">
            <h3 class="cm-section-title">Despesas por Categoria</h3>
            <div class="chart-wrapper" *ngIf="doughnutData().datasets[0].data.length > 0; else noDataTpl">
              <canvas baseChart
                [data]="doughnutData()"
                [options]="doughnutOptions"
                type="doughnut">
              </canvas>
            </div>
          </div>

          <div class="cm-card chart-card">
            <h3 class="cm-section-title">Entradas vs Saídas</h3>
            <div class="chart-wrapper">
              <canvas baseChart
                [data]="barData()"
                [options]="barOptions"
                type="bar">
              </canvas>
            </div>
          </div>
        </div>

        <!-- Ações rápidas -->
        <div class="quick-actions fade-up">
          <h3 class="cm-section-title">Ações rápidas</h3>
          <div class="actions-grid">
            <a mat-stroked-button routerLink="/transactions" [queryParams]="{ new: 'income' }">
              <mat-icon>add_circle</mat-icon>
              Nova entrada
            </a>
            <a mat-stroked-button routerLink="/transactions" [queryParams]="{ new: 'expense' }">
              <mat-icon>remove_circle</mat-icon>
              Nova saída
            </a>
            <a mat-stroked-button routerLink="/transactions">
              <mat-icon>receipt_long</mat-icon>
              Ver movimentações
            </a>
            <a mat-stroked-button routerLink="/recurring">
              <mat-icon>autorenew</mat-icon>
              Recorrências
            </a>
          </div>
        </div>
      </ng-container>
    </div>

    <ng-template #noDataTpl>
      <div class="no-data-chart">
        <mat-icon>bar_chart</mat-icon>
        <p>Sem dados neste mês</p>
      </div>
    </ng-template>
  `,
  styles: [`
    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 16px;
    }
    .page-title {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--cm-text);
      margin: 0;
    }
    .page-subtitle {
      color: var(--cm-text-muted);
      font-size: .875rem;
      margin: 4px 0 0;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 16px;
      margin-bottom: 16px;
    }

    .summary-card {
      background: var(--cm-surface);
      border-radius: var(--cm-radius);
      border: 1px solid var(--cm-border);
      padding: 20px;
      display: flex;
      align-items: center;
      gap: 16px;
      box-shadow: var(--cm-shadow);
      transition: box-shadow var(--cm-transition), transform var(--cm-transition);

      &:hover {
        box-shadow: var(--cm-shadow-md);
        transform: translateY(-1px);
      }
    }

    .card-icon {
      width: 48px; height: 48px;
      border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;

      mat-icon { font-size: 24px; width: 24px; height: 24px; }
    }

    .income .card-icon  { background: rgba(16,185,129,.12); color: var(--cm-income); }
    .expense .card-icon { background: rgba(239,68,68,.12);  color: var(--cm-expense); }
    .balance .card-icon { background: rgba(99,102,241,.12); color: var(--cm-primary); }
    .pending .card-icon { background: rgba(245,158,11,.12); color: var(--cm-pending); }
    .paid .card-icon    { background: rgba(16,185,129,.12); color: var(--cm-paid); }
    .overdue .card-icon.warn { background: rgba(239,68,68,.12); color: var(--cm-overdue); }

    .card-info {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .card-label {
      font-size: .75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: .05em;
      color: var(--cm-text-muted);
      margin-bottom: 4px;
    }

    .card-value {
      font-size: 1.375rem;
      font-weight: 700;
      letter-spacing: -.02em;
    }

    .income-value  { color: var(--cm-income); }
    .expense-value { color: var(--cm-expense); }
    .pending-value { color: var(--cm-pending); }
    .paid-value    { color: var(--cm-paid); }
    .overdue-value { color: var(--cm-overdue); font-size: 2rem; }

    .card-sub {
      font-size: .75rem;
      color: var(--cm-text-muted);
      margin-top: 2px;
    }

    .overdue-sub { color: var(--cm-overdue); font-weight: 500; }

    .progress-section {
      margin-bottom: 16px;
    }

    .progress-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      font-size: .875rem;
      font-weight: 500;
      color: var(--cm-text-muted);
    }

    .progress-pct {
      font-weight: 700;
      color: var(--cm-primary);
      &.danger { color: var(--cm-warn); }
    }

    .progress-hint {
      font-size: .75rem;
      color: var(--cm-text-muted);
      margin-top: 8px;
    }

    .charts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
      gap: 16px;
      margin-bottom: 16px;

      @media (max-width: 768px) { grid-template-columns: 1fr; }
    }

    .chart-card { padding: 24px; }

    .chart-wrapper {
      height: 260px;
      position: relative;
      canvas { max-height: 260px; }
    }

    .no-data-chart {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 200px;
      color: var(--cm-text-muted);
      gap: 8px;
      mat-icon { font-size: 48px; width: 48px; height: 48px; opacity: .3; }
    }

    .quick-actions { margin-top: 8px; }

    .actions-grid {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }

    .actions-grid a {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
    }
  `]
})
export class DashboardComponent implements OnInit {
  private readonly transactionService = inject(TransactionService);
  private readonly categoryService = inject(CategoryService);

  readonly loading = signal(true);
  readonly summary = signal<DashboardSummary | null>(null);
  readonly currentMonthDate = signal(startOfMonth(new Date()));

  readonly commitedPct = computed(() => {
    const s = this.summary();
    if (!s || s.total_income === 0) return 0;
    return Math.min(100, Math.round((s.total_expense / s.total_income) * 100));
  });

  // Doughnut: despesas por categoria
  readonly doughnutData = computed<ChartData<'doughnut'>>(() => {
    const txns = this.transactionService.transactions()
      .filter(t => t.transaction_type === 'expense');

    const byCategory: Record<string, number> = {};
    const colorMap: Record<string, string> = {};

    for (const t of txns) {
      const name = (t.category as any)?.name ?? 'Sem categoria';
      const color = (t.category as any)?.color ?? '#94a3b8';
      byCategory[name] = (byCategory[name] ?? 0) + Number(t.amount);
      colorMap[name] = color;
    }

    const labels = Object.keys(byCategory);
    return {
      labels,
      datasets: [{
        data: labels.map(l => byCategory[l]),
        backgroundColor: labels.map(l => colorMap[l] + 'CC'),
        borderColor: labels.map(l => colorMap[l]),
        borderWidth: 2,
        hoverOffset: 6
      }]
    };
  });

  // Bar: entradas vs saídas
  readonly barData = computed<ChartData<'bar'>>(() => {
    const s = this.summary();
    return {
      labels: ['Entradas', 'Saídas'],
      datasets: [{
        label: 'Valor (R$)',
        data: [s?.total_income ?? 0, s?.total_expense ?? 0],
        backgroundColor: ['rgba(16,185,129,.7)', 'rgba(239,68,68,.7)'],
        borderColor: ['#10b981', '#ef4444'],
        borderWidth: 2,
        borderRadius: 8
      }]
    };
  });

  readonly doughnutOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { padding: 16, font: { size: 12, family: 'Inter' } }
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const val = ctx.parsed;
            return ` ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val))}`;
          }
        }
      }
    }
  };

  readonly barOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const val = ctx.raw;
            return ` ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val))}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(0,0,0,.05)' },
        ticks: {
          callback: (val) => `R$ ${Number(val).toLocaleString('pt-BR')}`
        }
      },
      x: { grid: { display: false } }
    }
  };

  async ngOnInit(): Promise<void> {
    await this.loadData();
  }

  async onMonthChanged(date: Date): Promise<void> {
    this.currentMonthDate.set(date);
    this.transactionService.setCurrentMonth(date);
    await this.loadData();
  }

  private async loadData(): Promise<void> {
    this.loading.set(true);
    try {
      const monthStr = this.transactionService.getReferenceMonthString(this.currentMonthDate());
      await Promise.all([
        this.transactionService.loadTransactions(monthStr),
        this.categoryService.loadCategories()
      ]);
      const s = await this.transactionService.getDashboardSummary(monthStr);
      this.summary.set(s);
    } catch {
      // erro tratado silenciosamente — snackbar pode ser adicionado
    } finally {
      this.loading.set(false);
    }
  }
}
