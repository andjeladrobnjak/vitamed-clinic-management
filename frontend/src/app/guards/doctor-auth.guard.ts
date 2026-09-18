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

export const doctorPortalGuard: CanActivateFn = () => {
  const doctorAuth = inject(DoctorAuthService);
  const router = inject(Router);

  return doctorAuth.restoreSession().pipe(
    map((restored) => {
      if (!restored) {
        return router.createUrlTree(['/lekar/prijava']);
      }
      if (doctorAuth.mustChangePassword()) {
        return router.createUrlTree(['/lekar/promena-lozinke']);
      }
      return true;
    })
  );
};

export const doctorPasswordSetupGuard: CanActivateFn = () => {
  const doctorAuth = inject(DoctorAuthService);
  const router = inject(Router);

  return doctorAuth.restoreSession().pipe(
    map((restored) => {
      if (!restored) {
        return router.createUrlTree(['/lekar/prijava']);
      }
      if (!doctorAuth.mustChangePassword()) {
        return router.createUrlTree(['/lekar/portal']);
      }
      return true;
    })
  );
};
