import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { DoctorAuthService } from '../../services/doctor-auth.service';
import {
  CompleteAppointmentReportInput,
  DoctorDashboard,
  DoctorDashboardAppointment,
  DoctorPortalService
} from '../../services/doctor-portal.service';
import { DoctorPortalHeaderComponent } from '../doctor-portal-header/doctor-portal-header.component';
import { AppointmentReportModalComponent } from './appointment-report-modal.component';

@Component({
  selector: 'app-doctor-portal',
  standalone: true,
  imports: [DoctorPortalHeaderComponent, AppointmentReportModalComponent, RouterLink],
  templateUrl: './doctor-portal.component.html',
  styleUrl: './doctor-portal.component.css'
})
export class DoctorPortalComponent implements OnInit, OnDestroy {
  dashboard: DoctorDashboard | null = null;
  isLoading = true;
  loadError = '';
  selectedAppointment: DoctorDashboardAppointment | null = null;
  isCompleting = false;
  completeError = '';

  private readonly doctorAuth = inject(DoctorAuthService);
  private readonly portalService = inject(DoctorPortalService);
  private readonly router = inject(Router);
  private clockTimer: ReturnType<typeof setInterval> | null = null;

  readonly doctor = this.doctorAuth.doctor;
  readonly displayName = this.doctorAuth.displayName;
  readonly nowTick = signal(Date.now());

  ngOnInit(): void {
    this.loadDashboard();
    this.clockTimer = setInterval(() => {
      this.nowTick.set(Date.now());
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.clockTimer !== null) {
      clearInterval(this.clockTimer);
      this.clockTimer = null;
    }
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
    return this.scheduleWorkflow.next;
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

  get scheduleWorkflow(): {
    active: DoctorDashboardAppointment | null;
    next: DoctorDashboardAppointment | null;
  } {
    this.nowTick();
    const confirmed = (this.dashboard?.today.appointments ?? []).filter(
      (appointment) => appointment.status === 'confirmed'
    );
    const active = confirmed.find((appointment) => this.hasStarted(appointment)) ?? null;
    if (active) {
      const activeIndex = confirmed.findIndex((appointment) => appointment.id === active.id);
      return {
        active,
        next: confirmed[activeIndex + 1] ?? null
      };
    }

    return {
      active: null,
      next: confirmed.find((appointment) => !this.hasStarted(appointment)) ?? null
    };
  }

  patientName(appointment: DoctorDashboardAppointment): string {
    return `${appointment.patient.firstName} ${appointment.patient.lastName}`.trim();
  }

  isActive(appointment: DoctorDashboardAppointment): boolean {
    return this.scheduleWorkflow.active?.id === appointment.id;
  }

  isNext(appointment: DoctorDashboardAppointment): boolean {
    return this.scheduleWorkflow.next?.id === appointment.id;
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

  canViewReport(appointment: DoctorDashboardAppointment): boolean {
    return appointment.status === 'completed'
      && appointment.hasReport
      && appointment.patient.id !== null
      && appointment.patient.id > 0;
  }

  openCompletion(appointment: DoctorDashboardAppointment): void {
    if (!this.isActive(appointment) || this.isCompleting) {
      return;
    }
    this.completeError = '';
    this.selectedAppointment = appointment;
  }

  closeCompletion(): void {
    if (this.isCompleting) {
      return;
    }
    this.selectedAppointment = null;
    this.completeError = '';
  }

  submitCompletion(report: CompleteAppointmentReportInput): void {
    const appointment = this.selectedAppointment;
    if (!appointment || this.isCompleting) {
      return;
    }

    this.isCompleting = true;
    this.completeError = '';

    this.portalService.completeAppointment(appointment.id, report).subscribe({
      next: () => {
        this.isCompleting = false;
        this.selectedAppointment = null;
        this.completeError = '';
        this.refreshDashboard();
      },
      error: (error: HttpErrorResponse) => {
        this.isCompleting = false;
        if (error.status === 401) {
          this.doctorAuth.logout();
          void this.router.navigate(['/lekar/prijava']);
          return;
        }
        this.completeError = error.error?.message || 'Trenutno nije moguće završiti pregled.';
      }
    });
  }

  private hasStarted(appointment: DoctorDashboardAppointment): boolean {
    const date = this.dashboard?.today.date;
    if (!date) {
      return false;
    }

    const [year, month, day] = date.split('-').map(Number);
    const [hours, minutes] = appointment.startTime.split(':').map(Number);
    if (
      !Number.isInteger(year) ||
      !Number.isInteger(month) ||
      !Number.isInteger(day) ||
      !Number.isInteger(hours) ||
      !Number.isInteger(minutes)
    ) {
      return false;
    }

    const start = new Date(year, month - 1, day, hours, minutes, 0, 0);
    return this.nowTick() >= start.getTime();
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

  private refreshDashboard(): void {
    this.portalService.getDashboard().subscribe({
      next: (dashboard) => {
        this.dashboard = dashboard;
        this.loadError = '';
      },
      error: (error: HttpErrorResponse) => {
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
