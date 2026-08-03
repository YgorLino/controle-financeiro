// src/app/shared/components/skeleton-loader/skeleton-loader.component.ts
import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-skeleton-loader',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="skeleton-wrapper">
      <div
        *ngFor="let i of items"
        class="skeleton"
        [style.width]="width"
        [style.height]="height"
        [style.margin-bottom]="gap">
      </div>
    </div>
  `,
  styles: [`
    .skeleton-wrapper { width: 100%; }
  `]
})
export class SkeletonLoaderComponent {
  @Input() count: number = 3;
  @Input() height: string = '56px';
  @Input() width: string = '100%';
  @Input() gap: string = '12px';

  get items(): number[] {
    return Array.from({ length: this.count }, (_, i) => i);
  }
}
