// src/app/shared/components/skeleton-loader/skeleton-loader.component.ts
import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-skeleton-loader',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './skeleton-loader.component.html',
  styleUrl: './skeleton-loader.component.scss'
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
