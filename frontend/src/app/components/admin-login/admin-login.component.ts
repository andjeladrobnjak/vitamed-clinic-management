import { Component, inject, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminAuthService } from '../../services/admin-auth.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './admin-login.component.html',
  styleUrl: './admin-login.component.css'
})
export class AdminLoginComponent implements OnInit {
  passwordVisible = false;
  isSubmitting = false;
  serverError = '';

  private readonly fb = inject(FormBuilder);
  private readonly adminAuth = inject(AdminAuthService);
  private readonly router = inject(Router);

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required]
  });

  ngOnInit(): void {
    if (this.adminAuth.isLoggedIn()) {
      void this.router.navigate(['/admin/portal']);
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

    this.adminAuth.login(formValue.email ?? '', formValue.password ?? '').subscribe({
      next: () => {
        this.isSubmitting = false;
        void this.router.navigate(['/admin/portal']);
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
