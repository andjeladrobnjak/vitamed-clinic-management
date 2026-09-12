import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

const backendOrigin = 'http://localhost:3000';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  if (token && req.url.startsWith(backendOrigin)) {
    return next(req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    }));
  }

  return next(req);
};
