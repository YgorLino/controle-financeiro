// src/app/shared/components/empty-state/empty-state.component.ts
import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  template: `
    <div class="empty-state fade-up">
      <div class="empty-icon">
        <mat-icon>{{ icon }}</mat-icon>
      </div>
      <h3>{{ title }}</h3>
      <p>{{ message }}</p>
      <button
        *ngIf="actionLabel"
        mat-flat-button color="primary"
        (click)="onAction()">
        <mat-icon>add</mat-icon>
        {{ actionLabel }}
      </button>
    </div>
  `,
  styles: [`
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 64px 24px;
      text-align: center;
      gap: 12px;
    }
    .empty-icon {
      width: 72px; height: 72px;
      border-radius: 50%;
      background: var(--cm-primary-light);
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 8px;
    }
    .empty-icon mat-icon {
      font-size: 36px; width: 36px; height: 36px;
      color: var(--cm-primary);
    }
    h3 { font-size: 1.125rem; font-weight: 600; color: var(--cm-text); }
    p { color: var(--cm-text-muted); max-width: 360px; line-height: 1.6; }
    button { display: flex; align-items: center; gap: 8px; }
  `]
})
export class EmptyStateComponent {
  @Input() icon: string = 'inbox';
  @Input() title: string = 'Nenhum resultado encontrado';
  @Input() message: string = '';
  @Input() actionLabel: string = '';
  @Output() action = new EventEmitter<void>();

  onAction(): void { this.action.emit(); }
}
