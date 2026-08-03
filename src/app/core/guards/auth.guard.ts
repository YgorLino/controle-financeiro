// src/app/core/guards/auth.guard.ts
import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Aguardar inicialização assíncrona do AuthService
  if (auth.loading()) {
    await new Promise<void>(resolve => {
      const check = () => {
        if (!auth.loading()) { resolve(); }
        else { setTimeout(check, 50); }
      };
      check();
    });
  }

  if (auth.isAuthenticated()) return true;
  return router.createUrlTree(['/auth/login']);
};

export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.loading()) {
    await new Promise<void>(resolve => {
      const check = () => {
        if (!auth.loading()) { resolve(); }
        else { setTimeout(check, 50); }
      };
      check();
    });
  }

  if (!auth.isAuthenticated()) return true;
  return router.createUrlTree(['/dashboard']);
};
