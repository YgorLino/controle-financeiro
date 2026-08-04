// src/app/core/services/notification.service.ts
import { Injectable, inject } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly snackBar = inject(MatSnackBar);

  private defaultConfig: MatSnackBarConfig = {
    duration: 4000,
    horizontalPosition: 'center',
    verticalPosition: 'top'
  };

  success(message: string): void {
    this.snackBar.open(message, 'Fechar', {
      ...this.defaultConfig,
      panelClass: ['snack-success']
    });
  }

  error(message: string): void {
    this.snackBar.open(message, 'Fechar', {
      ...this.defaultConfig,
      duration: 6000,
      panelClass: ['snack-error']
    });
  }

  info(message: string): void {
    this.snackBar.open(message, 'Fechar', {
      ...this.defaultConfig,
      panelClass: ['snack-info']
    });
  }
}
