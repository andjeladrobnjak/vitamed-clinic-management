import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { DoctorAuthService } from '../services/doctor-auth.service';

const backendOrigin = 'http://localhost:3000';

function isDoctorBackendUrl(url: string): boolean {
  return (
    url.startsWith(`${backendOrigin}/api/doctor-auth`) ||
    url.startsWith(`${backendOrigin}/api/doctor-portal`)
  );
}

function isDoctorLoginUrl(url: string): boolean {
  return url.startsWith(`${backendOrigin}/api/doctor-auth/login`);
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(backendOrigin)) {
    return next(req);
  }

  const patientAuth = inject(AuthService);
  const doctorAuth = inject(DoctorAuthService);
  const router = inject(Router);
  const token = isDoctorBackendUrl(req.url)
    ? doctorAuth.getToken()
    : patientAuth.getToken();

  const authorizedReq = token
    ? req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      })
    : req;

  return next(authorizedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (
        error.status === 401 &&
        isDoctorBackendUrl(req.url) &&
        !isDoctorLoginUrl(req.url)
      ) {
        doctorAuth.logout();
        if (!router.url.startsWith('/lekar/prijava')) {
          void router.navigate(['/lekar/prijava']);
        }
      }
      return throwError(() => error);
    })
  );
};

