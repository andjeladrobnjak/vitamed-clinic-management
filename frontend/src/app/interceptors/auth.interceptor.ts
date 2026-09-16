import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { DoctorAuthService } from '../services/doctor-auth.service';

const backendOrigin = 'http://localhost:3000';

function isDoctorBackendUrl(url: string): boolean {
  return (
    url.startsWith(`${backendOrigin}/api/doctor-auth`) ||
    url.startsWith(`${backendOrigin}/api/doctor-portal`)
  );
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(backendOrigin)) {
    return next(req);
  }

  const patientAuth = inject(AuthService);
  const doctorAuth = inject(DoctorAuthService);
  const token = isDoctorBackendUrl(req.url)
    ? doctorAuth.getToken()
    : patientAuth.getToken();

  if (!token) {
    return next(req);
  }

  return next(req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  }));
};
