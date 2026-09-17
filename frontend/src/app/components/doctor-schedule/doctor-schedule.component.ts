import { Component, OnInit, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { DoctorAuthService } from '../../services/doctor-auth.service';
import {
  DoctorPortalMonthSchedule,
  DoctorPortalScheduleAppointment,
  DoctorPortalScheduleDay,
  DoctorPortalScheduleShift,
  DoctorPortalService
} from '../../services/doctor-portal.service';
import { DoctorPortalHeaderComponent } from '../doctor-portal-header/doctor-portal-header.component';
import {
  DoctorCancelAppointmentModalComponent,
  DoctorCancelAppointmentSummary
} from './doctor-cancel-appointment-modal.component';
import { formatSerbianDate } from '../../utils/format-serbian-date';

interface CalendarCell {
  date: string;
  dayNumber: number;
  inMonth: boolean;
  shift: DoctorPortalScheduleShift | null;
  appointmentCount: number;
  appointments: DoctorPortalScheduleAppointment[];
}

@Component({
  selector: 'app-doctor-schedule',
  standalone: true,
  imports: [DoctorPortalHeaderComponent, RouterLink, DoctorCancelAppointmentModalComponent],
  templateUrl: './doctor-schedule.component.html',
  styleUrl: './doctor-schedule.component.css'
})
export class DoctorScheduleComponent implements OnInit {
  readonly weekdayLabels = ['Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub', 'Ned'];

  year: number;
  month: number;
  schedule: DoctorPortalMonthSchedule | null = null;
  cells: CalendarCell[] = [];
  selectedDate: string | null = null;
  isLoading = true;
  loadError = '';
  pendingCancel: DoctorPortalScheduleAppointment | null = null;
  isCancelling = false;
  cancelError = '';

  private readonly portalService = inject(DoctorPortalService);
  private readonly doctorAuth = inject(DoctorAuthService);
  private readonly router = inject(Router);

  constructor() {
    const today = this.clinicToday();
    const [year, month] = today.split('-').map(Number);
    this.year = year;
    this.month = month;
  }

  ngOnInit(): void {
    this.loadMonth();
  }

  get monthTitle(): string {
    const label = new Intl.DateTimeFormat('sr-Latn-RS', {
      month: 'long',
      year: 'numeric'
    }).format(new Date(this.year, this.month - 1, 1));
    return `${label.replace(/\.$/, '').toLocaleUpperCase('sr-Latn')}.`;
  }

  get selectedCell(): (CalendarCell & { shift: DoctorPortalScheduleShift }) | null {
    const cell = this.cells.find((item) => item.date === this.selectedDate);
    if (!cell?.shift) {
      return null;
    }
    return cell as CalendarCell & { shift: DoctorPortalScheduleShift };
  }

  get selectedHeading(): string {
    if (!this.selectedCell) {
      return '';
    }
    return this.formatPanelDate(this.selectedCell.date);
  }

  get cancelSummary(): DoctorCancelAppointmentSummary | null {
    if (!this.pendingCancel || !this.selectedDate) {
      return null;
    }
    return {
      patientName: this.patientName(this.pendingCancel),
      dateLabel: formatSerbianDate(this.selectedDate),
      startTime: this.pendingCancel.startTime
    };
  }

  previousMonth(): void {
    if (this.month === 1) {
      this.month = 12;
      this.year -= 1;
    } else {
      this.month -= 1;
    }
    this.selectedDate = null;
    this.pendingCancel = null;
    this.loadMonth();
  }

  nextMonth(): void {
    if (this.month === 12) {
      this.month = 1;
      this.year += 1;
    } else {
      this.month += 1;
    }
    this.selectedDate = null;
    this.pendingCancel = null;
    this.loadMonth();
  }

  selectDay(cell: CalendarCell): void {
    if (!cell.shift) {
      return;
    }
    this.selectedDate = this.selectedDate === cell.date ? null : cell.date;
  }

  closePanel(): void {
    if (this.isCancelling) {
      return;
    }
    this.pendingCancel = null;
    this.selectedDate = null;
  }

  appointmentCountLabel(count: number): string {
    return count === 1 ? '1 termin' : `${count} termina`;
  }

  patientName(appointment: DoctorPortalScheduleAppointment): string {
    return `${appointment.patient.firstName} ${appointment.patient.lastName}`.trim();
  }

  canOpenPatient(appointment: DoctorPortalScheduleAppointment): boolean {
    return appointment.patient.id !== null;
  }

  canCancelAppointment(appointment: DoctorPortalScheduleAppointment): boolean {
    if (appointment.status !== 'confirmed' || !this.selectedDate) {
      return false;
    }
    return this.startsAtLeastHoursAhead(this.selectedDate, appointment.startTime, 24);
  }

  openCancel(appointment: DoctorPortalScheduleAppointment, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.canCancelAppointment(appointment) || this.isCancelling) {
      return;
    }
    this.cancelError = '';
    this.pendingCancel = appointment;
  }

  closeCancel(): void {
    if (this.isCancelling) {
      return;
    }
    this.pendingCancel = null;
    this.cancelError = '';
  }

  confirmCancel(): void {
    if (!this.pendingCancel || this.isCancelling) {
      return;
    }

    this.isCancelling = true;
    this.cancelError = '';
    const appointmentId = this.pendingCancel.id;

    this.portalService.cancelAppointment(appointmentId).subscribe({
      next: () => {
        this.isCancelling = false;
        this.pendingCancel = null;
        this.cancelError = '';
        this.loadMonth(true);
      },
      error: (error: HttpErrorResponse) => {
        this.isCancelling = false;
        if (error.status === 401) {
          this.doctorAuth.logout();
          void this.router.navigate(['/lekar/prijava']);
          return;
        }
        this.cancelError = error.error?.message || 'Pregled trenutno nije moguće otkazati.';
      }
    });
  }

  private loadMonth(silent = false): void {
    if (!silent) {
      this.isLoading = true;
      this.loadError = '';
      this.schedule = null;
      this.cells = [];
    }

    this.portalService.getMonthSchedule(this.year, this.month).subscribe({
      next: (schedule) => {
        this.schedule = schedule;
        this.cells = this.buildCells(schedule);
        this.isLoading = false;
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading = false;
        if (error.status === 401) {
          this.doctorAuth.logout();
          void this.router.navigate(['/lekar/prijava']);
          return;
        }
        this.loadError = error.error?.message || 'Trenutno nije moguće učitati raspored.';
      }
    });
  }

  private buildCells(schedule: DoctorPortalMonthSchedule): CalendarCell[] {
    const shifts = new Map<number, DoctorPortalScheduleShift>();
    for (const shift of schedule.shifts) {
      shifts.set(shift.dayOfWeek, shift);
    }

    const days = new Map<string, DoctorPortalScheduleDay>();
    for (const day of schedule.days) {
      days.set(day.date, day);
    }

    const monthKey = String(schedule.month).padStart(2, '0');
    const cells: CalendarCell[] = [];
    let current = schedule.from;
    while (current <= schedule.to) {
      const weekday = this.isoWeekday(current);
      const day = days.get(current);
      cells.push({
        date: current,
        dayNumber: Number(current.slice(8, 10)),
        inMonth: current.slice(5, 7) === monthKey,
        shift: shifts.get(weekday) ?? null,
        appointmentCount: day?.appointmentCount ?? 0,
        appointments: day?.appointments ?? []
      });
      current = this.addDay(current, 1);
    }
    return cells;
  }

  private formatPanelDate(isoDate: string): string {
    const [year, month, day] = isoDate.split('-').map(Number);
    const weekday = new Intl.DateTimeFormat('sr-Latn-RS', {
      weekday: 'long'
    }).format(new Date(year, month - 1, day));
    const capitalized = weekday.charAt(0).toLocaleUpperCase('sr-Latn') + weekday.slice(1);
    return `${capitalized}, ${formatSerbianDate(isoDate)}`;
  }

  private clinicToday(): string {
    return this.clinicClock().date;
  }

  private startsAtLeastHoursAhead(isoDate: string, startTime: string, hours: number): boolean {
    const clock = this.clinicClock();
    const [hoursPart, minutesPart] = startTime.split(':').map(Number);
    const startMinutes = hoursPart * 60 + minutesPart;
    const dayDiff = this.calendarDayDiff(clock.date, isoDate);
    return dayDiff * 24 * 60 + startMinutes - clock.minutes >= hours * 60;
  }

  private clinicClock(): { date: string; minutes: number } {
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

  private calendarDayDiff(fromIsoDate: string, toIsoDate: string): number {
    const [fromYear, fromMonth, fromDay] = fromIsoDate.split('-').map(Number);
    const [toYear, toMonth, toDay] = toIsoDate.split('-').map(Number);
    const fromUtc = Date.UTC(fromYear, fromMonth - 1, fromDay);
    const toUtc = Date.UTC(toYear, toMonth - 1, toDay);
    return Math.round((toUtc - fromUtc) / 86_400_000);
  }

  private isoWeekday(isoDate: string): number {
    const [year, month, day] = isoDate.split('-').map(Number);
    const utcDay = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay();
    return utcDay === 0 ? 7 : utcDay;
  }

  private addDay(isoDate: string, amount: number): string {
    const [year, month, day] = isoDate.split('-').map(Number);
    const next = new Date(Date.UTC(year, month - 1, day + amount, 12, 0, 0));
    return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
  }
}
