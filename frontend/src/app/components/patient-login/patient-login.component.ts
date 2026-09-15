import { Component, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PatientLoginRequest, PatientService } from '../../services/patient.service';
import { AuthService } from '../../services/auth.service';
import { returnUrlQueryParams, sanitizeReturnUrl } from '../../utils/safe-return-url';

@Component({
  selector: 'app-patient-login',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './patient-login.component.html',
  styleUrl: './patient-login.component.css'
})
export class PatientLoginComponent {
  passwordVisible = false;
  isSubmitting = false;
  serverError = '';
  successMessage = '';

  private readonly fb = inject(FormBuilder);
  private readonly patientService = inject(PatientService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  get registerQueryParams(): Record<string, string> {
    return returnUrlQueryParams(this.returnUrl);
  }

  private get returnUrl(): string | null {
    return sanitizeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
  }

  togglePassword(): void {
    this.passwordVisible = !this.passwordVisible;
  }

  onSubmit(): void {
    this.serverError = '';
    this.successMessage = '';

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    if (this.isSubmitting) {
      return;
    }

    const formValue = this.loginForm.getRawValue();
    const payload: PatientLoginRequest = {
      email: formValue.email ?? '',
      password: formValue.password ?? ''
    };

    this.isSubmitting = true;

    this.patientService.login(payload).subscribe({
      next: (response) => {
        this.authService.saveSession(response.token, response.patient);
        this.isSubmitting = false;
        const returnUrl = this.returnUrl;
        if (returnUrl) {
          void this.router.navigateByUrl(returnUrl);
        } else {
          void this.router.navigate(['/moj-vitamed']);
        }
      },
      error: (error: HttpErrorResponse) => {
        this.isSubmitting = false;
        if (error.status === 401) {
          this.serverError = error.error?.message || 'Email ili lozinka nisu ispravni.';
          return;
        }

        this.serverError = error.error?.message || 'Došlo je do greške. Pokušajte ponovo.';
      }
    });
  }
}
