import { Component, inject, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DoctorAuthService } from '../../services/doctor-auth.service';

@Component({
  selector: 'app-doctor-login',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './doctor-login.component.html',
  styleUrl: './doctor-login.component.css'
})
export class DoctorLoginComponent implements OnInit {
  passwordVisible = false;
  isSubmitting = false;
  serverError = '';

  private readonly fb = inject(FormBuilder);
  private readonly doctorAuth = inject(DoctorAuthService);
  private readonly router = inject(Router);

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required]
  });

  ngOnInit(): void {
    if (this.doctorAuth.isLoggedIn()) {
      void this.router.navigate(['/lekar/portal']);
    }
  }

  togglePassword(): void {
    this.passwordVisible = !this.passwordVisible;
  }

  onSubmit(): void {
    this.serverError = '';

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    if (this.isSubmitting) {
      return;
    }

    const formValue = this.loginForm.getRawValue();
    this.isSubmitting = true;

    this.doctorAuth.login(formValue.email ?? '', formValue.password ?? '').subscribe({
      next: () => {
        this.isSubmitting = false;
        void this.router.navigate(['/lekar/portal']);
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
