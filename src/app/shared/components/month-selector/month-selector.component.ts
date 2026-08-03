// src/app/shared/components/month-selector/month-selector.component.ts
import {
  Component, Input, Output, EventEmitter,
  ChangeDetectionStrategy, OnInit, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { format, addMonths, subMonths, startOfMonth, isEqual } from 'date-fns';
import { ptBR } from 'date-fns/locale';

@Component({
  selector: 'app-month-selector',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
    <div class="month-selector">
      <button mat-icon-button (click)="prev()" matTooltip="Mês anterior">
        <mat-icon>chevron_left</mat-icon>
      </button>

      <div class="month-label">
        <span class="month-name">{{ monthLabel() }}</span>
        <button
          *ngIf="!isCurrentMonth()"
          mat-icon-button
          class="today-btn"
          (click)="goToToday()"
          matTooltip="Ir para o mês atual">
          <mat-icon>today</mat-icon>
        </button>
      </div>

      <button mat-icon-button (click)="next()" matTooltip="Próximo mês">
        <mat-icon>chevron_right</mat-icon>
      </button>
    </div>
  `,
  styles: [`
    .month-selector {
      display: flex;
      align-items: center;
      gap: 4px;
      background: var(--cm-surface);
      border: 1px solid var(--cm-border);
      border-radius: var(--cm-radius);
      padding: 4px 8px;
    }
    .month-label {
      display: flex;
      align-items: center;
      gap: 4px;
      min-width: 160px;
      justify-content: center;
    }
    .month-name {
      font-size: 1rem;
      font-weight: 600;
      color: var(--cm-text);
      letter-spacing: -.01em;
    }
    .today-btn {
      width: 28px !important;
      height: 28px !important;
      opacity: .6;
      mat-icon { font-size: 16px !important; }
    }
  `]
})
export class MonthSelectorComponent implements OnInit {
  @Input() currentDate: Date = startOfMonth(new Date());
  @Output() monthChanged = new EventEmitter<Date>();

  private _date = signal<Date>(startOfMonth(new Date()));

  monthLabel = () => {
    const label = format(this._date(), 'MMMM yyyy', { locale: ptBR });
    return label.charAt(0).toUpperCase() + label.slice(1);
  };

  ngOnInit(): void {
    this._date.set(startOfMonth(this.currentDate));
  }

  isCurrentMonth(): boolean {
    return isEqual(this._date(), startOfMonth(new Date()));
  }

  prev(): void {
    const d = subMonths(this._date(), 1);
    this._date.set(d);
    this.monthChanged.emit(d);
  }

  next(): void {
    const d = addMonths(this._date(), 1);
    this._date.set(d);
    this.monthChanged.emit(d);
  }

  goToToday(): void {
    const d = startOfMonth(new Date());
    this._date.set(d);
    this.monthChanged.emit(d);
  }
}
