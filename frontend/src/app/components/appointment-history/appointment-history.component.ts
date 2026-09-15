import { Component, inject, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AppointmentAvailabilityApi, HistoryAppointment } from '../../services/appointment-availability.service';
import { DoctorReviewApi } from '../../services/doctor-review.service';
import { formatSerbianDate } from '../../utils/format-serbian-date';
import { SiteHeaderComponent } from '../site-header/site-header.component';
import { DoctorReviewModalComponent } from '../doctor-review-modal/doctor-review-modal.component';

@Component({
  selector: 'app-appointment-history',
  standalone: true,
  imports: [SiteHeaderComponent, DoctorReviewModalComponent],
  templateUrl: './appointment-history.component.html',
  styleUrls: ['../patient-portal/patient-portal-page.css', './appointment-history.component.css']
})
export class AppointmentHistoryComponent implements OnInit {
  appointments: HistoryAppointment[] = [];
  isLoading = true;
  loadError = '';
  successMessage = '';

  reviewTarget: HistoryAppointment | null = null;
  isSavingReview = false;
  reviewError = '';

  private readonly appointmentApi = inject(AppointmentAvailabilityApi);
  private readonly reviewApi = inject(DoctorReviewApi);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    this.loadHistory();
  }

  formatDisplayDate(value: string): string {
    return formatSerbianDate(value);
  }

  retry(): void {
    this.loadHistory();
  }

  openReviewModal(appointment: HistoryAppointment): void {
    if (this.isSavingReview) {
      return;
    }

    this.reviewError = '';
    this.reviewTarget = appointment;
  }

  closeReviewModal(): void {
    if (this.isSavingReview) {
      return;
    }

    this.reviewTarget = null;
    this.reviewError = '';
  }

  submitReview(payload: { rating: number; comment: string | null }): void {
    const appointment = this.reviewTarget;
    if (!appointment || this.isSavingReview) {
      return;
    }

    this.isSavingReview = true;
    this.reviewError = '';

    const existing = appointment.review;
    const request = existing
      ? this.reviewApi.updateReview(existing.id, {
          rating: payload.rating,
          comment: payload.comment
        })
      : this.reviewApi.createReview({
          appointmentId: appointment.id,
          rating: payload.rating,
          comment: payload.comment
        });

    request.subscribe({
      next: (review) => {
        this.isSavingReview = false;
        this.reviewTarget = null;
        this.applyReview(appointment.id, {
          id: review.id,
          rating: review.rating,
          comment: review.comment
        });
        this.successMessage = existing
          ? 'Izmene ocene su uspešno sačuvane.'
          : 'Hvala! Vaša ocena je uspešno sačuvana.';
      },
      error: (error: HttpErrorResponse) => {
        this.isSavingReview = false;
        if (error.status === 409 && !existing) {
          this.reviewTarget = null;
          this.reviewError = '';
          this.appointmentApi.getAppointmentHistory().subscribe({
            next: (response) => {
              this.appointments = response.appointments ?? [];
            }
          });
          return;
        }

        this.reviewError = error.error?.message || 'Došlo je do greške prilikom čuvanja ocene. Pokušajte ponovo.';
      }
    });
  }

  private applyReview(
    appointmentId: number,
    review: { id: number; rating: number; comment: string | null }
  ): void {
    this.appointments = this.appointments.map((item) =>
      item.id === appointmentId ? { ...item, review } : item
    );
  }

  private loadHistory(): void {
    this.isLoading = true;
    this.loadError = '';

    this.appointmentApi.getAppointmentHistory().subscribe({
      next: (response) => {
        this.appointments = response.appointments ?? [];
        this.isLoading = false;
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading = false;
        if (error.status === 401) {
          this.authService.logout();
          void this.router.navigate(['/prijava']);
          return;
        }

        this.appointments = [];
        this.loadError = 'Trenutno nije moguće učitati istoriju pregleda.';
      }
    });
  }
}
