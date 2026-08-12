import { Injectable, inject, NgZone, OnDestroy } from '@angular/core';
import { AuthService } from './auth.service';
import { NotificationService } from './notification.service';
import { fromEvent, merge, Subscription, timer } from 'rxjs';
import { switchMap, startWith, filter } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class AutoLogoutService implements OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly notificationService = inject(NotificationService);
  private readonly ngZone = inject(NgZone);

  // 1 hour in milliseconds
  private readonly INACTIVITY_TIMEOUT = 60 * 60 * 1000;
  private readonly LAST_ACTIVITY_KEY = 'lastActivityTime';
  private activitySubscription?: Subscription;

  constructor() {
    this.checkInitialInactivity();
    this.startWatching();
  }

  private checkInitialInactivity(): void {
    const lastActivityStr = localStorage.getItem(this.LAST_ACTIVITY_KEY);
    if (lastActivityStr) {
      const lastActivityTime = parseInt(lastActivityStr, 10);
      const currentTime = new Date().getTime();
      
      if (currentTime - lastActivityTime > this.INACTIVITY_TIMEOUT) {
        // Logout if they exceeded time while tab was closed
        this.logoutUser(true);
      }
    }
    // Update activity since they just loaded the app
    this.updateLastActivityTime();
  }

  private updateLastActivityTime(): void {
    localStorage.setItem(this.LAST_ACTIVITY_KEY, new Date().getTime().toString());
  }

  private startWatching(): void {
    this.ngZone.runOutsideAngular(() => {
      const events$ = merge(
        fromEvent(window, 'mousemove'),
        fromEvent(window, 'keydown'),
        fromEvent(window, 'click'),
        fromEvent(window, 'scroll')
      );

      this.activitySubscription = events$
        .pipe(
          startWith(null), // Trigger the timer initially
          switchMap(() => {
            this.updateLastActivityTime();
            return timer(this.INACTIVITY_TIMEOUT);
          })
        )
        .subscribe(() => {
          this.ngZone.run(() => {
            this.logoutUser(false);
          });
        });
    });
  }

  private logoutUser(isInitialCheck: boolean): void {
    if (this.authService.isAuthenticated()) {
      if (!isInitialCheck) {
        this.notificationService.info('Sessão expirada por inatividade. Por favor, faça login novamente.');
      } else {
        this.notificationService.info('Sua sessão expirou por tempo de inatividade.');
      }
      this.authService.signOut();
    }
  }

  ngOnDestroy(): void {
    if (this.activitySubscription) {
      this.activitySubscription.unsubscribe();
    }
  }
}
