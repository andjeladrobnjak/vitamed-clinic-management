import { Component, inject, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AppointmentAvailabilityApi, UpcomingAppointment } from '../../services/appointment-availability.service';
import { formatSerbianDate } from '../../utils/format-serbian-date';
import { SiteHeaderComponent } from '../site-header/site-header.component';
import { CancelAppointmentModalComponent } from '../patient-dashboard/cancel-appointment-modal.component';

@Component({
  selector: 'app-patient-appointments',
  standalone: true,
  imports: [RouterLink, SiteHeaderComponent, CancelAppointmentModalComponent],
  templateUrl: './patient-appointments.component.html',
  styleUrls: [
    '../patient-portal/patient-portal-page.css',
    '../patient-portal/patient-upcoming-card.css',
    './patient-appointments.component.css'
  ]
})
export class PatientAppointmentsComponent implements OnInit {
  appointments: UpcomingAppointment[] = [];
  isLoading = true;
  loadError = '';

  cancelTarget: UpcomingAppointment | null = null;
  isCancelling = false;
  cancelError = '';

  private readonly appointmentApi = inject(AppointmentAvailabilityApi);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    this.loadAppointments();
  }

  formatDisplayDate(value: string): string {
    return formatSerbianDate(value);
  }

  openCancelModal(appointment: UpcomingAppointment): void {
    if (this.isCancelling) {
      return;
    }

    this.cancelError = '';
    this.cancelTarget = appointment;
  }

  closeCancelModal(): void {
    if (this.isCancelling) {
      return;
    }

    this.cancelTarget = null;
    this.cancelError = '';
  }

  confirmCancel(): void {
    const appointment = this.cancelTarget;
    if (!appointment || this.isCancelling) {
      return;
    }

    this.isCancelling = true;
    this.cancelError = '';

    this.appointmentApi.cancelAppointment(appointment.id).subscribe({
      next: () => {
        this.isCancelling = false;
        this.cancelTarget = null;
        this.loadAppointments();
      },
      error: (error: HttpErrorResponse) => {
        this.isCancelling = false;
        this.cancelError = error.error?.message || 'Pregled trenutno nije moguće otkazati. Pokušajte ponovo.';
      }
    });
  }

  retry(): void {
    this.loadAppointments();
  }

  private loadAppointments(): void {
    this.isLoading = true;
    this.loadError = '';

    this.appointmentApi.getUpcomingAppointments().subscribe({
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
        this.loadError = 'Trenutno nije moguće učitati predstojeće preglede.';
      }
    });
  }
}
