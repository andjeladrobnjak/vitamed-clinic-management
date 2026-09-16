import { Component, OnInit, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { DoctorAuthService } from '../../services/doctor-auth.service';
import {
  DoctorDashboard,
  DoctorDashboardAppointment,
  DoctorPortalService
} from '../../services/doctor-portal.service';
import { DoctorPortalHeaderComponent } from '../doctor-portal-header/doctor-portal-header.component';

@Component({
  selector: 'app-doctor-portal',
  standalone: true,
  imports: [DoctorPortalHeaderComponent],
  templateUrl: './doctor-portal.component.html',
  styleUrl: './doctor-portal.component.css'
})
export class DoctorPortalComponent implements OnInit {
  dashboard: DoctorDashboard | null = null;
  isLoading = true;
  loadError = '';

  private readonly doctorAuth = inject(DoctorAuthService);
  private readonly portalService = inject(DoctorPortalService);
  private readonly router = inject(Router);

  readonly doctor = this.doctorAuth.doctor;
  readonly displayName = this.doctorAuth.displayName;

  ngOnInit(): void {
    this.loadDashboard();
  }

  get todayLabel(): string {
    const sourceDate = this.dashboard?.today.date;
    const date = sourceDate
      ? new Date(`${sourceDate}T12:00:00`)
      : new Date();

    const formatted = new Intl.DateTimeFormat('sr-Latn-RS', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(date);

    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }

  get appointmentCount(): number {
    return this.dashboard?.today.appointmentCount ?? 0;
  }

  get nextAppointment(): DoctorDashboardAppointment | null {
    return this.dashboard?.today.nextAppointment ?? null;
  }

  get nextTimeLabel(): string {
    return this.nextAppointment?.startTime ?? '—';
  }

  get nextCountdownLabel(): string {
    const next = this.nextAppointment;
    if (!next) {
      return 'nema preostalih termina';
    }
    return this.formatCountdown(next.startTime);
  }

  patientName(appointment: DoctorDashboardAppointment): string {
    return `${appointment.patient.firstName} ${appointment.patient.lastName}`.trim();
  }

  isNext(appointment: DoctorDashboardAppointment): boolean {
    return this.nextAppointment?.id === appointment.id;
  }

  statusLabel(appointment: DoctorDashboardAppointment): string {
    if (appointment.status === 'completed') {
      return 'Završeno';
    }
    if (this.isNext(appointment)) {
      return 'Sledeći';
    }
    return 'Zakazano';
  }

  statusKey(appointment: DoctorDashboardAppointment): 'completed' | 'next' | 'scheduled' {
    if (appointment.status === 'completed') {
      return 'completed';
    }
    if (this.isNext(appointment)) {
      return 'next';
    }
    return 'scheduled';
  }

  private loadDashboard(): void {
    this.isLoading = true;
    this.loadError = '';
    this.dashboard = null;

    this.portalService.getDashboard().subscribe({
      next: (dashboard) => {
        this.dashboard = dashboard;
        this.isLoading = false;
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading = false;
        this.dashboard = null;
        if (error.status === 401) {
          this.doctorAuth.logout();
          void this.router.navigate(['/lekar/prijava']);
          return;
        }

        this.loadError = error.error?.message || 'Trenutno nije moguće učitati pregled dana.';
      }
    });
  }

  private formatCountdown(startTime: string): string {
    const [hours, minutes] = startTime.split(':').map(Number);
    if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
      return '';
    }

    const start = new Date();
    start.setHours(hours, minutes, 0, 0);
    const diffMinutes = Math.round((start.getTime() - Date.now()) / 60000);

    if (diffMinutes <= 0) {
      return 'uskoro';
    }
    if (diffMinutes < 60) {
      return `za ${diffMinutes} min`;
    }

    const hoursLeft = Math.floor(diffMinutes / 60);
    const minutesLeft = diffMinutes % 60;
    if (minutesLeft === 0) {
      return `za ${hoursLeft} h`;
    }
    return `za ${hoursLeft} h ${minutesLeft} min`;
  }
}
