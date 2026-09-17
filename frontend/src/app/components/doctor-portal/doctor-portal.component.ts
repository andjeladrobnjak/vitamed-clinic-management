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
import { DoctorNoShowModalComponent } from './doctor-no-show-modal.component';
import { ReportDraftService } from '../../services/report-draft.service';

@Component({
  selector: 'app-doctor-portal',
  standalone: true,
  imports: [
    DoctorPortalHeaderComponent,
    AppointmentReportModalComponent,
    DoctorNoShowModalComponent,
    RouterLink
  ],
  templateUrl: './doctor-portal.component.html',
  styleUrl: './doctor-portal.component.css'
})
export class DoctorPortalComponent implements OnInit, OnDestroy {
  dashboard: DoctorDashboard | null = null;
  isLoading = true;
  loadError = '';
  selectedAppointment: DoctorDashboardAppointment | null = null;
  pendingNoShow: DoctorDashboardAppointment | null = null;
  isCompleting = false;
  isMarkingNoShow = false;
  completeError = '';
  noShowError = '';

  private readonly doctorAuth = inject(DoctorAuthService);
  private readonly portalService = inject(DoctorPortalService);
  private readonly drafts = inject(ReportDraftService);
  private readonly router = inject(Router);
  private clockTimer: ReturnType<typeof setTimeout> | null = null;

  readonly doctor = this.doctorAuth.doctor;
  readonly displayName = this.doctorAuth.displayName;
  readonly nowTick = signal(Date.now());

  ngOnInit(): void {
    this.loadDashboard();
    this.armClock();
  }

  ngOnDestroy(): void {
    this.clearClock();
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

  get remainingAppointmentCount(): number {
    return (this.dashboard?.today.appointments ?? []).filter(
      (appointment) => appointment.status === 'confirmed'
    ).length;
  }

  get nextAppointment(): DoctorDashboardAppointment | null {
    this.nowTick();
    return (this.dashboard?.today.appointments ?? []).find(
      (appointment) => appointment.status === 'confirmed' && !this.hasStarted(appointment)
    ) ?? null;
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

  isCurrent(appointment: DoctorDashboardAppointment): boolean {
    if (appointment.status !== 'confirmed') {
      return false;
    }
    return this.hasStarted(appointment) && !this.hasEnded(appointment);
  }

  canComplete(appointment: DoctorDashboardAppointment): boolean {
    return appointment.status === 'confirmed' && this.hasStarted(appointment);
  }

  canMarkNoShow(appointment: DoctorDashboardAppointment): boolean {
    return appointment.status === 'confirmed' && this.hasStarted(appointment);
  }

  canViewReport(appointment: DoctorDashboardAppointment): boolean {
    return appointment.status === 'completed'
      && appointment.hasReport
      && appointment.patient.id !== null
      && appointment.patient.id > 0;
  }

  openCompletion(appointment: DoctorDashboardAppointment): void {
    if (!this.canComplete(appointment) || this.isCompleting || this.isMarkingNoShow) {
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
        this.drafts.clear(appointment.id);
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

  openNoShow(appointment: DoctorDashboardAppointment): void {
    if (!this.canMarkNoShow(appointment) || this.isMarkingNoShow || this.isCompleting) {
      return;
    }
    this.noShowError = '';
    this.pendingNoShow = appointment;
  }

  closeNoShow(): void {
    if (this.isMarkingNoShow) {
      return;
    }
    this.pendingNoShow = null;
    this.noShowError = '';
  }

  confirmNoShow(): void {
    if (!this.pendingNoShow || this.isMarkingNoShow) {
      return;
    }

    this.isMarkingNoShow = true;
    this.noShowError = '';

    this.portalService.markAppointmentNoShow(this.pendingNoShow.id).subscribe({
      next: () => {
        this.isMarkingNoShow = false;
        this.pendingNoShow = null;
        this.noShowError = '';
        this.refreshDashboard();
      },
      error: (error: HttpErrorResponse) => {
        this.isMarkingNoShow = false;
        if (error.status === 401) {
          this.doctorAuth.logout();
          void this.router.navigate(['/lekar/prijava']);
          return;
        }
        this.noShowError = error.error?.message || 'Trenutno nije moguće označiti nepojavljivanje.';
      }
    });
  }

  private armClock(): void {
    this.nowTick.set(Date.now());
    this.clearClock();
    const msUntilNextMinute = 60_000 - (Date.now() % 60_000) + 50;
    this.clockTimer = setTimeout(() => this.armClock(), msUntilNextMinute);
  }

  private clearClock(): void {
    if (this.clockTimer !== null) {
      clearTimeout(this.clockTimer);
      this.clockTimer = null;
    }
  }

  private hasStarted(appointment: DoctorDashboardAppointment): boolean {
    const clock = this.clinicClock();
    const date = this.dashboard?.today.date;
    if (!date) {
      return false;
    }
    const dayDiff = this.calendarDayDiff(clock.date, date);
    return dayDiff * 24 * 60 + this.timeToMinutes(appointment.startTime) - clock.minutes <= 0;
  }

  private hasEnded(appointment: DoctorDashboardAppointment): boolean {
    const clock = this.clinicClock();
    const date = this.dashboard?.today.date;
    if (!date) {
      return false;
    }
    const dayDiff = this.calendarDayDiff(clock.date, date);
    return dayDiff * 24 * 60 + this.timeToMinutes(appointment.endTime) - clock.minutes <= 0;
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
    const clock = this.clinicClock();
    const date = this.dashboard?.today.date;
    if (!date) {
      return '';
    }
    const diffMinutes = this.calendarDayDiff(clock.date, date) * 24 * 60
      + this.timeToMinutes(startTime)
      - clock.minutes;

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

  private clinicClock(): { date: string; minutes: number } {
    this.nowTick();
    const date = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Belgrade'
    }).format(new Date());
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Belgrade',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(new Date());
    const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
    const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');
    return { date, minutes: hour * 60 + minute };
  }

  private timeToMinutes(value: string): number {
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private calendarDayDiff(fromIsoDate: string, toIsoDate: string): number {
    const [fromYear, fromMonth, fromDay] = fromIsoDate.split('-').map(Number);
    const [toYear, toMonth, toDay] = toIsoDate.split('-').map(Number);
    const fromUtc = Date.UTC(fromYear, fromMonth - 1, fromDay);
    const toUtc = Date.UTC(toYear, toMonth - 1, toDay);
    return Math.round((toUtc - fromUtc) / 86_400_000);
  }
}
