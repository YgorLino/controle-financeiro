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
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
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

  readonly realizedBalance = computed(() => {
    const txns = this.transactionService.transactions();
    const realizedIncome = txns
      .filter(t => t.transaction_type === 'income' && t.status === 'paid')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const realizedExpense = txns
      .filter(t => t.transaction_type === 'expense' && t.status === 'paid')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    return realizedIncome - realizedExpense;
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
