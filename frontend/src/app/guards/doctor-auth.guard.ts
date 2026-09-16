import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs/operators';
import { DoctorAuthService } from '../services/doctor-auth.service';

export const doctorAuthGuard: CanActivateFn = () => {
  const doctorAuth = inject(DoctorAuthService);
  const router = inject(Router);

  return doctorAuth.restoreSession().pipe(
    map((restored) => restored || router.createUrlTree(['/lekar/prijava']))
  );
};
