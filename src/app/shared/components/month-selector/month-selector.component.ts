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
  templateUrl: './month-selector.component.html',
  styleUrl: './month-selector.component.scss'
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
