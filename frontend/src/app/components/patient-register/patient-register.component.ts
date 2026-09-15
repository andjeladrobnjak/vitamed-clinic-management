import { Component, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { PatientRegisterRequest, PatientService } from '../../services/patient.service';
import { returnUrlQueryParams, sanitizeReturnUrl } from '../../utils/safe-return-url';

function passwordsMatchValidator(form: AbstractControl): ValidationErrors | null {
  const password = form.get('password')?.value;
  const confirmPassword = form.get('confirmPassword')?.value;

  if (!password || !confirmPassword) {
    return null;
  }

  return password === confirmPassword
    ? null
    : { passwordMismatch: true };
}

@Component({
  selector: 'app-patient-register',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './patient-register.component.html',
  styleUrl: './patient-register.component.css'
})
export class PatientRegisterComponent {
  passwordVisible = false;
  confirmPasswordVisible = false;
  isSubmitting = false;
  serverError = '';
  successMessage = '';

  private readonly fb = inject(FormBuilder);
  private readonly patientService = inject(PatientService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  registerForm = this.fb.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    jmbg: ['', [Validators.required, Validators.pattern(/^\d{13}$/)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, Validators.pattern(/^\+381 \d{2} \d{3} \d{4}$/)]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', Validators.required],
    termsAccepted: [false, Validators.requiredTrue],
  }, {
    validators: passwordsMatchValidator
  });

  get loginQueryParams(): Record<string, string> {
    return returnUrlQueryParams(this.returnUrl);
  }

  private get returnUrl(): string | null {
    return sanitizeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
  }

  togglePassword(): void {
    this.passwordVisible = !this.passwordVisible;
  }

  toggleConfirmPassword(): void {
    this.confirmPasswordVisible = !this.confirmPasswordVisible;
  }

  get phoneNationalNumber(): string {
    const value = this.registerForm.controls.phone.value ?? '';
    return value.replace(/^\+381\s*/, '');
  }

  onPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const nationalNumber = this.formatNationalNumber(input.value);
    input.value = nationalNumber;
    this.registerForm.controls.phone.setValue(
      nationalNumber ? `+381 ${nationalNumber}` : ''
    );
  }

  onPhoneBlur(): void {
    this.registerForm.controls.phone.markAsTouched();
  }

  private formatNationalNumber(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 9);
    const parts = [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 9)];
    return parts.filter(Boolean).join(' ');
  }

  private formatSerbianMobile(value: string): string {
    const nationalNumber = this.formatNationalNumber(value.replace(/^\+381\s*/, ''));
    return nationalNumber ? `+381 ${nationalNumber}` : '';
  }

  onSubmit(): void {
    this.serverError = '';
    this.successMessage = '';

    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    if (this.isSubmitting) {
      return;
    }

    const formValue = this.registerForm.getRawValue();
    const formattedPhone = this.formatSerbianMobile(formValue.phone ?? '');
    this.registerForm.controls.phone.setValue(formattedPhone);

    const payload: PatientRegisterRequest = {
      firstName: formValue.firstName ?? '',
      lastName: formValue.lastName ?? '',
      jmbg: formValue.jmbg ?? '',
      email: formValue.email ?? '',
      phone: formattedPhone,
      password: formValue.password ?? '',
      confirmPassword: formValue.confirmPassword ?? ''
    };

    this.isSubmitting = true;

    this.patientService.register(payload).subscribe({
      next: (response) => {
        this.isSubmitting = false;
        this.successMessage = response.message;
        setTimeout(() => {
          void this.router.navigate(['/prijava'], {
            queryParams: this.loginQueryParams
          });
        }, 1500);
      },
      error: (error: HttpErrorResponse) => {
        this.isSubmitting = false;
        this.serverError = error.error?.message || 'Došlo je do greške. Pokušajte ponovo.';
      }
    });
  }
}
