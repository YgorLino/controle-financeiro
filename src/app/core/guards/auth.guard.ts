// src/app/core/guards/auth.guard.ts
import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { AccessService } from '../services/access.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.waitUntilReady();

  if (auth.isAuthenticated()) return true;
  return router.createUrlTree(['/auth/login']);
};

export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.waitUntilReady();

  if (!auth.isAuthenticated()) return true;
  return router.createUrlTree(['/dashboard']);
};

export const subscriptionGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const access = inject(AccessService);

  await auth.waitUntilReady();

  if (!auth.isAuthenticated()) return router.createUrlTree(['/auth/login']);

  await access.ensureInitialized();

  if (access.hasValidAccess()) {
    return true;
  }

  return router.createUrlTree(['/subscription'], { queryParams: { reason: 'trial-ended' }});
};
