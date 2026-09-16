import { Component, inject, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { LucideCalendar, LucideChevronRight, LucideClock, LucideUser } from '@lucide/angular';
import { AuthService } from '../../services/auth.service';
import { PatientService } from '../../services/patient.service';
import { AppointmentAvailabilityApi, UpcomingAppointment } from '../../services/appointment-availability.service';
import { SiteHeaderComponent } from '../site-header/site-header.component';
import { CancelAppointmentModalComponent } from './cancel-appointment-modal.component';

@Component({
  selector: 'app-patient-dashboard',
  standalone: true,
  imports: [RouterLink, SiteHeaderComponent, CancelAppointmentModalComponent],
  templateUrl: './patient-dashboard.component.html',
  styleUrls: [
    '../patient-portal/patient-upcoming-card.css',
    './patient-dashboard.component.css'
  ]
})
export class PatientDashboardComponent implements OnInit {
  readonly calendarIcon = LucideCalendar.icon.node;
  readonly clockIcon = LucideClock.icon.node;
  readonly userIcon = LucideUser.icon.node;
  readonly chevronIcon = LucideChevronRight.icon.node;

  firstName = '';
  isLoading = true;
  loadError = '';

  upcomingAppointment: UpcomingAppointment | null = null;
  upcomingLoading = true;
  upcomingError = '';

  cancelModalOpen = false;
  isCancelling = false;
  cancelError = '';

  private readonly patientService = inject(PatientService);
  private readonly appointmentApi = inject(AppointmentAvailabilityApi);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    const sessionPatient = this.authService.patient();
    if (sessionPatient?.firstName) {
      this.firstName = sessionPatient.firstName;
      this.isLoading = false;
    }

    this.patientService.getMe().subscribe({
      next: (patient) => {
        this.firstName = patient.firstName;
        this.isLoading = false;
      },
      error: (error: HttpErrorResponse) => {
        if (error.status === 401) {
          this.authService.logout();
          void this.router.navigate(['/prijava']);
          return;
        }

        this.isLoading = false;
        if (!this.firstName) {
          this.loadError = 'Podaci trenutno nisu dostupni. Pokušajte ponovo.';
        }
      }
    });

    this.loadUpcoming();
  }

  formatDisplayDate(value: string): string {
    const [year, month, day] = value.split('-').map(Number);
    return new Intl.DateTimeFormat('sr-Latn-RS', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(new Date(year, month - 1, day));
  }

  openCancelModal(): void {
    if (!this.upcomingAppointment || this.isCancelling) {
      return;
    }

    this.cancelError = '';
    this.cancelModalOpen = true;
  }

  closeCancelModal(): void {
    if (this.isCancelling) {
      return;
    }

    this.cancelModalOpen = false;
    this.cancelError = '';
  }

  confirmCancel(): void {
    const appointment = this.upcomingAppointment;
    if (!appointment || this.isCancelling) {
      return;
    }

    this.isCancelling = true;
    this.cancelError = '';

    this.appointmentApi.cancelAppointment(appointment.id).subscribe({
      next: () => {
        this.isCancelling = false;
        this.cancelModalOpen = false;
        this.loadUpcoming();
      },
      error: (error: HttpErrorResponse) => {
        this.isCancelling = false;
        this.cancelError = error.error?.message || 'Pregled trenutno nije moguće otkazati. Pokušajte ponovo.';
      }
    });
  }

  retryUpcoming(): void {
    this.loadUpcoming();
  }

  private loadUpcoming(): void {
    this.upcomingLoading = true;
    this.upcomingError = '';

    this.appointmentApi.getUpcomingAppointment().subscribe({
      next: (response) => {
        this.upcomingAppointment = response.appointment;
        this.upcomingLoading = false;
      },
      error: (error: HttpErrorResponse) => {
        this.upcomingLoading = false;
        if (error.status === 401) {
          this.authService.logout();
          void this.router.navigate(['/prijava']);
          return;
        }

        this.upcomingAppointment = null;
        this.upcomingError = 'Trenutno nije moguće učitati predstojeći pregled.';
      }
    });
  }
}
