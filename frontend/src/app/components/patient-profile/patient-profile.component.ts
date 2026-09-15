import { Component, inject, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { PatientProfileUpdate, PatientService } from '../../services/patient.service';
import { SiteHeaderComponent } from '../site-header/site-header.component';

@Component({
  selector: 'app-patient-profile',
  standalone: true,
  imports: [ReactiveFormsModule, SiteHeaderComponent],
  templateUrl: './patient-profile.component.html',
  styleUrls: ['../patient-portal/patient-portal-page.css', './patient-profile.component.css']
})
export class PatientProfileComponent implements OnInit {
  isLoading = true;
  isSaving = false;
  loadError = '';
  serverError = '';
  successMessage = '';
  jmbg = '';

  private readonly fb = inject(FormBuilder);
  private readonly patientService = inject(PatientService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  profileForm = this.fb.group({
    firstName: ['', [Validators.required, Validators.maxLength(100)]],
    lastName: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, Validators.pattern(/^\+381 \d{2} \d{3} \d{4}$/)]]
  });

  ngOnInit(): void {
    this.patientService.getMe().subscribe({
      next: (patient) => {
        this.jmbg = patient.jmbg ?? '';
        this.profileForm.patchValue({
          firstName: patient.firstName,
          lastName: patient.lastName,
          email: patient.email,
          phone: patient.phone ?? ''
        });
        this.isLoading = false;
      },
      error: (error: HttpErrorResponse) => {
        if (error.status === 401) {
          this.authService.logout();
          void this.router.navigate(['/prijava']);
          return;
        }

        this.isLoading = false;
        this.loadError = 'Podaci trenutno nisu dostupni. Pokušajte ponovo.';
      }
    });
  }

  get phoneNationalNumber(): string {
    const value = this.profileForm.controls.phone.value ?? '';
    return value.replace(/^\+381\s*/, '');
  }

  onPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const nationalNumber = this.formatNationalNumber(input.value);
    input.value = nationalNumber;
    this.profileForm.controls.phone.setValue(
      nationalNumber ? `+381 ${nationalNumber}` : '',
      { emitEvent: false }
    );
  }

  onPhoneBlur(): void {
    this.profileForm.controls.phone.markAsTouched();
  }

  onSubmit(): void {
    this.serverError = '';
    this.successMessage = '';

    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    if (this.isSaving) {
      return;
    }

    const formValue = this.profileForm.getRawValue();
    const formattedPhone = this.formatSerbianMobile(formValue.phone ?? '');
    this.profileForm.controls.phone.setValue(formattedPhone, { emitEvent: false });

    const payload: PatientProfileUpdate = {
      firstName: (formValue.firstName ?? '').trim(),
      lastName: (formValue.lastName ?? '').trim(),
      email: (formValue.email ?? '').trim().toLowerCase(),
      phone: formattedPhone
    };

    this.isSaving = true;

    this.patientService.updateMe(payload).subscribe({
      next: (patient) => {
        this.isSaving = false;
        this.successMessage = 'Izmene su uspešno sačuvane.';
        this.jmbg = patient.jmbg ?? this.jmbg;
        this.profileForm.patchValue({
          firstName: patient.firstName,
          lastName: patient.lastName,
          email: patient.email,
          phone: patient.phone ?? formattedPhone
        });
        this.authService.setPatient({
          id: patient.id,
          firstName: patient.firstName,
          lastName: patient.lastName,
          email: patient.email
        });
      },
      error: (error: HttpErrorResponse) => {
        this.isSaving = false;
        this.serverError = error.error?.message || 'Izmene trenutno nije moguće sačuvati. Pokušajte ponovo.';
      }
    });
  }

  retry(): void {
    this.isLoading = true;
    this.loadError = '';
    this.ngOnInit();
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
}
