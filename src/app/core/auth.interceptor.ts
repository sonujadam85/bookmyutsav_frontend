import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const toast = inject(ToastService);
  const token = auth.token;
  const authReq = token && req.url.startsWith('/api') ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && !req.url.endsWith('/auth/login')) {
        auth.clear();
        toast.error('Your session has expired. Please log in again.');
        router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
      }
      return throwError(() => err);
    })
  );
};
