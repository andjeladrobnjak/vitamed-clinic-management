import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';

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

  togglePassword(): void {
    this.passwordVisible = !this.passwordVisible;
  }

  toggleConfirmPassword(): void {
    this.confirmPasswordVisible = !this.confirmPasswordVisible;
  }

  private fb = inject(FormBuilder);

  registerForm = this.fb.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    jmbg: ['', [Validators.required, Validators.pattern(/^\d{13}$/)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, Validators.pattern(/^\+381 \d{3} \d{3} \d{4}$/)]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', Validators.required],
  }, {
    validators: passwordsMatchValidator
  });
}
