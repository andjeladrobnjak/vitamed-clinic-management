import { Component, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DoctorAuthService } from '../../services/doctor-auth.service';

function passwordsMatchValidator(form: AbstractControl): ValidationErrors | null {
  const password = form.get('password')?.value;
  const confirmPassword = form.get('confirmPassword')?.value;
  if (!password || !confirmPassword) {
    return null;
  }
  return password === confirmPassword ? null : { passwordMismatch: true };
}

function passwordPolicyValidator(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '');
  if (!value) {
    return null;
  }
  if (value.length < 8 || !/[A-Z]/.test(value) || !/[a-z]/.test(value) || !/[0-9]/.test(value)) {
    return { policy: true };
  }
  return null;
}

@Component({
  selector: 'app-doctor-change-password',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './doctor-change-password.component.html',
  styleUrls: ['../doctor-login/doctor-login.component.css']
})
export class DoctorChangePasswordComponent {
  passwordVisible = false;
  confirmVisible = false;
  isSubmitting = false;
  serverError = '';

  private readonly fb = inject(FormBuilder);
  private readonly doctorAuth = inject(DoctorAuthService);
  private readonly router = inject(Router);

  form = this.fb.group(
    {
      password: ['', [Validators.required, passwordPolicyValidator]],
      confirmPassword: ['', Validators.required]
    },
    { validators: passwordsMatchValidator }
  );

  togglePassword(): void {
    this.passwordVisible = !this.passwordVisible;
  }

  toggleConfirm(): void {
    this.confirmVisible = !this.confirmVisible;
  }

  logout(): void {
    this.doctorAuth.logout();
    void this.router.navigate(['/lekar/prijava']);
  }

  onSubmit(): void {
    this.serverError = '';
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.isSubmitting) {
      return;
    }

    const value = this.form.getRawValue();
    this.isSubmitting = true;
    this.doctorAuth.changePassword(value.password ?? '', value.confirmPassword ?? '').subscribe({
      next: () => {
        this.isSubmitting = false;
        void this.router.navigate(['/lekar/portal']);
      },
      error: (error: HttpErrorResponse) => {
        this.isSubmitting = false;
        this.serverError = error.error?.message || 'Trenutno nije moguće promeniti lozinku.';
      }
    });
  }
}
