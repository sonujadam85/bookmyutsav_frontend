import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  if (auth.isLoggedIn()) return true;
  return inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  if (auth.isAdmin()) return true;
  return inject(Router).createUrlTree(['/dashboard']);
};

/** Login users are managed only in the platform owner's company. */
export const mainAdminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  if (auth.isAdmin() && auth.isMainCompany()) return true;
  return inject(Router).createUrlTree(['/dashboard']);
};

export const superGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  if (auth.isSuper()) return true;
  return inject(Router).createUrlTree(['/dashboard']);
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isLoggedIn() ? inject(Router).createUrlTree(['/dashboard']) : true;
};
