import { NgTemplateOutlet } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideCalendarOff, LucideChevronRight, LucidePlus, LucideX } from '@lucide/angular';
import {
  AdminEligibleExceptionDoctor,
  AdminPortalService,
  AdminScheduleDayDetail,
  AdminWeeklyAbsenceReason,
  AdminWeeklySchedule,
  AdminWeeklyScheduleEntry
} from '../../services/admin-portal.service';
import { ClinicLocation, LocationService } from '../../services/location.service';

@Component({
  selector: 'app-admin-schedule',
  standalone: true,
  imports: [FormsModule, RouterLink, NgTemplateOutlet],
  templateUrl: './admin-schedule.component.html',
  styleUrls: ['./admin-schedule.component.css', './admin-schedule-week.css', './admin-schedule-modals.css']
})
export class AdminScheduleComponent implements OnInit {
  readonly weekdayLabels = ['PON', 'UTO', 'SRE', 'ČET', 'PET', 'SUB', 'NED'];
  readonly weekdayFull = ['Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak', 'Subota', 'Nedelja'];
  readonly hourOptions = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'));
  readonly minuteOptions = ['00', '15', '30', '45'];
  readonly calendarOffIcon = LucideCalendarOff.icon.node;
  readonly plusIcon = LucidePlus.icon.node;
  readonly closeIcon = LucideX.icon.node;
  readonly chevronIcon = LucideChevronRight.icon.node;

  locations: ClinicLocation[] = [];
  selectedLocationId = 0;
  weekStart = '';
  schedule: AdminWeeklySchedule | null = null;
  isLoadingLocations = true;
  isLoadingSchedule = false;
  locationsError = '';
  scheduleError = '';
  successMessage = '';

  detail: AdminScheduleDayDetail | null = null;
  isLoadingDetail = false;
  detailError = '';
  editorOpen = false;
  editorError = '';
  isSaving = false;
  restoreOpen = false;
  restoreError = '';
  isRestoring = false;

  createOpen = false;
  createDate = '';
  eligibleDoctors: AdminEligibleExceptionDoctor[] = [];
  isLoadingEligible = false;
  eligibleError = '';
  createDoctorId: number | null = null;
  createLocations: { id: number; name: string }[] = [];

  startHour = '08';
  startMinute = '00';
  endHour = '14';
  endMinute = '00';
  editorLocationId: number | null = null;

  private readonly portalService = inject(AdminPortalService);
  private readonly locationService = inject(LocationService);
  private successTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.weekStart = this.mondayOf(this.clinicToday());
    this.loadLocations();
  }

  get weekRangeLabel(): string {
    if (!this.schedule) {
      return this.formatWeekRange(this.weekStart, this.addDay(this.weekStart, 6));
    }
    return this.formatWeekRange(this.schedule.weekStart, this.schedule.weekEnd);
  }

  get isCurrentWeek(): boolean {
    return this.weekStart === this.mondayOf(this.clinicToday());
  }

  get editorContextDate(): string {
    return this.detail?.date ?? this.createDate;
  }

  get editorDoctorName(): string {
    if (this.detail) {
      return this.doctorName(this.detail.doctor.firstName, this.detail.doctor.lastName);
    }
    const selected = this.eligibleDoctors.find((doctor) => doctor.id === this.createDoctorId);
    return selected ? this.doctorName(selected.firstName, selected.lastName) : '';
  }

  get restoreDateLabel(): string {
    return this.detail ? this.dotDate(this.detail.date) : '';
  }

  get locationChoices(): { id: number; name: string }[] {
    if (this.detail?.locations?.length) {
      return this.detail.locations;
    }
    if (this.createLocations.length) {
      return this.createLocations;
    }
    return this.schedule?.location ? [this.schedule.location] : [];
  }

  doctorLabel(entry: AdminWeeklyScheduleEntry): string {
    return this.doctorName(entry.firstName, entry.lastName);
  }

  doctorName(firstName: string, lastName: string): string {
    return `dr ${firstName} ${lastName}`.trim();
  }

  absenceLabel(reason: AdminWeeklyAbsenceReason): string {
    if (reason === 'annual_leave') {
      return 'Godišnji odmor';
    }
    if (reason === 'sick_leave') {
      return 'Bolovanje';
    }
    if (reason === 'day_off') {
      return 'Slobodan dan';
    }
    return 'Drugo';
  }

  dayDateLabel(isoDate: string): string {
    const [, month, day] = isoDate.split('-');
    return `${day}.${month}.`;
  }

  isToday(isoDate: string): boolean {
    return isoDate === this.clinicToday();
  }

  canAddException(isoDate: string): boolean {
    return isoDate >= this.clinicToday();
  }

  headingDate(detail: AdminScheduleDayDetail): string {
    const [year, month, day] = detail.date.split('-').map(Number);
    const monthLabel = new Intl.DateTimeFormat('sr-Latn-RS', { month: 'long' }).format(
      new Date(year, month - 1, day)
    );
    return `${this.weekdayFull[detail.weekday - 1]}, ${day}. ${monthLabel}`.toLocaleUpperCase('sr-Latn');
  }

  editorDateLabel(): string {
    const iso = this.editorContextDate;
    if (!iso) {
      return '';
    }
    const [year, month, day] = iso.split('-').map(Number);
    const weekday = new Intl.DateTimeFormat('sr-Latn-RS', { weekday: 'long' }).format(
      new Date(year, month - 1, day)
    );
    const dateLabel = new Intl.DateTimeFormat('sr-Latn-RS', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(new Date(year, month - 1, day));
    const weekdayLabel = weekday.charAt(0).toLocaleUpperCase('sr-Latn') + weekday.slice(1);
    return `${weekdayLabel}, ${dateLabel}`;
  }

  onLocationChange(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    if (!Number.isInteger(value) || value <= 0 || value === this.selectedLocationId) {
      return;
    }
    this.selectedLocationId = value;
    this.closeAll();
    this.loadSchedule();
  }

  previousWeek(): void {
    this.weekStart = this.addDay(this.weekStart, -7);
    this.closeAll();
    this.loadSchedule();
  }

  nextWeek(): void {
    this.weekStart = this.addDay(this.weekStart, 7);
    this.closeAll();
    this.loadSchedule();
  }

  goToToday(): void {
    const currentMonday = this.mondayOf(this.clinicToday());
    if (this.weekStart === currentMonday && this.schedule && !this.scheduleError) {
      return;
    }
    this.weekStart = currentMonday;
    this.closeAll();
    this.loadSchedule();
  }

  retryLoad(): void {
    if (this.locationsError || this.locations.length === 0) {
      this.loadLocations();
      return;
    }
    this.loadSchedule();
  }

  openDay(entry: AdminWeeklyScheduleEntry, date: string): void {
    if (this.editorOpen || this.restoreOpen || this.isSaving) {
      return;
    }
    this.detailError = '';
    this.isLoadingDetail = true;
    this.detail = {
      doctor: {
        id: entry.doctorId,
        firstName: entry.firstName,
        lastName: entry.lastName,
        specialtyName: entry.specialtyName
      },
      date,
      weekday: this.isoWeekday(date),
      absent: Boolean(entry.absenceReason),
      absenceReason: entry.absenceReason,
      regular: null,
      exception: null,
      effective: entry.absenceReason
        ? null
        : {
            startTime: entry.startTime,
            endTime: entry.endTime,
            location: { id: this.selectedLocationId, name: this.schedule?.location.name ?? '' },
            source: entry.isException ? 'exception' : 'regular'
          },
      locations: [],
      canEdit: !entry.absenceReason && date >= this.clinicToday(),
      canRestore: Boolean(entry.isException) && date >= this.clinicToday()
    };

    this.portalService.getScheduleDay(entry.doctorId, date).subscribe({
      next: (detail) => {
        this.detail = detail;
        this.isLoadingDetail = false;
      },
      error: (error: HttpErrorResponse) => {
        this.isLoadingDetail = false;
        this.detailError = error.error?.message || 'Trenutno nije moguće učitati detalje smene.';
      }
    });
  }

  closeDetail(): void {
    if (this.editorOpen || this.restoreOpen || this.isSaving || this.isRestoring) {
      return;
    }
    this.detail = null;
    this.detailError = '';
    this.isLoadingDetail = false;
  }

  openEditorFromDetail(): void {
    if (!this.detail?.canEdit) {
      return;
    }
    this.editorError = '';
    const source = this.detail.exception ?? this.detail.regular;
    this.startHour = this.hourOf(source?.startTime ?? '08:00');
    this.startMinute = this.minuteOf(source?.startTime ?? '08:00');
    this.endHour = this.hourOf(source?.endTime ?? '14:00');
    this.endMinute = this.minuteOf(source?.endTime ?? '14:00');
    this.editorLocationId = source?.location.id ?? this.selectedLocationId;
    this.editorOpen = true;
  }

  openCreate(date: string): void {
    if (!this.canAddException(date) || !this.selectedLocationId) {
      return;
    }
    this.createOpen = true;
    this.createDate = date;
    this.createDoctorId = null;
    this.createLocations = [];
    this.eligibleDoctors = [];
    this.eligibleError = '';
    this.editorError = '';
    this.startHour = '08';
    this.startMinute = '00';
    this.endHour = '14';
    this.endMinute = '00';
    this.editorLocationId = this.selectedLocationId;
    this.isLoadingEligible = true;

    this.portalService.getEligibleExceptionDoctors(this.selectedLocationId, date).subscribe({
      next: (result) => {
        this.eligibleDoctors = result.doctors;
        this.isLoadingEligible = false;
      },
      error: (error: HttpErrorResponse) => {
        this.isLoadingEligible = false;
        this.eligibleError = error.error?.message || 'Trenutno nije moguće učitati lekare.';
      }
    });
  }

  onCreateDoctorChange(doctorId: number | null): void {
    this.createDoctorId = doctorId;
    if (!doctorId) {
      this.createLocations = [];
      this.editorLocationId = this.selectedLocationId;
      return;
    }
    this.portalService.getScheduleDay(doctorId, this.createDate).subscribe({
      next: (detail) => {
        this.createLocations = detail.locations;
        const stillAssigned = detail.locations.some((location) => location.id === this.selectedLocationId);
        this.editorLocationId = stillAssigned ? this.selectedLocationId : (detail.locations[0]?.id ?? null);
      },
      error: () => {
        this.createLocations = [];
      }
    });
  }

  closeEditor(): void {
    if (this.isSaving) {
      return;
    }
    this.editorOpen = false;
    this.editorError = '';
    if (!this.detail) {
      this.createOpen = false;
      this.createDate = '';
      this.createDoctorId = null;
    }
  }

  closeCreate(): void {
    if (this.isSaving) {
      return;
    }
    this.createOpen = false;
    this.createDate = '';
    this.createDoctorId = null;
    this.eligibleError = '';
    this.editorError = '';
  }

  saveException(): void {
    const doctorId = this.detail?.doctor.id ?? this.createDoctorId;
    const date = this.detail?.date ?? this.createDate;
    if (!doctorId || !date || !this.editorLocationId) {
      this.editorError = 'Izaberite lekara, vreme i lokaciju.';
      return;
    }

    this.isSaving = true;
    this.editorError = '';
    this.portalService
      .saveScheduleException(doctorId, date, {
        startTime: `${this.startHour}:${this.startMinute}`,
        endTime: `${this.endHour}:${this.endMinute}`,
        locationId: this.editorLocationId
      })
      .subscribe({
        next: (result) => {
          this.isSaving = false;
          this.editorOpen = false;
          this.createOpen = false;
          this.showSuccess(result.message || 'Posebna smena je uspešno sačuvana.');
          this.refreshAfterMutation(doctorId, date);
        },
        error: (error: HttpErrorResponse) => {
          this.isSaving = false;
          this.editorError = error.error?.message || 'Trenutno nije moguće sačuvati posebnu smenu.';
        }
      });
  }

  openRestore(): void {
    if (!this.detail?.canRestore) {
      return;
    }
    this.restoreError = '';
    this.restoreOpen = true;
  }

  closeRestore(): void {
    if (this.isRestoring) {
      return;
    }
    this.restoreOpen = false;
    this.restoreError = '';
  }

  confirmRestore(): void {
    if (!this.detail) {
      return;
    }
    this.isRestoring = true;
    this.restoreError = '';
    this.portalService.deleteScheduleException(this.detail.doctor.id, this.detail.date).subscribe({
      next: (result) => {
        const doctorId = this.detail?.doctor.id ?? 0;
        const date = this.detail?.date ?? '';
        this.isRestoring = false;
        this.restoreOpen = false;
        this.showSuccess(result.message || 'Redovni raspored je vraćen za izabrani datum.');
        this.refreshAfterMutation(doctorId, date);
      },
      error: (error: HttpErrorResponse) => {
        this.isRestoring = false;
        this.restoreError = error.error?.message || 'Trenutno nije moguće vratiti redovni raspored.';
      }
    });
  }

  private refreshAfterMutation(doctorId: number, date: string): void {
    this.loadSchedule();
    if (!doctorId || !date) {
      return;
    }
    this.isLoadingDetail = true;
    this.portalService.getScheduleDay(doctorId, date).subscribe({
      next: (detail) => {
        this.detail = detail;
        this.isLoadingDetail = false;
        this.detailError = '';
      },
      error: (error: HttpErrorResponse) => {
        this.isLoadingDetail = false;
        this.detail = null;
        this.detailError = error.error?.message || '';
      }
    });
  }

  private closeAll(): void {
    this.detail = null;
    this.detailError = '';
    this.editorOpen = false;
    this.restoreOpen = false;
    this.createOpen = false;
    this.editorError = '';
    this.restoreError = '';
  }

  private showSuccess(message: string): void {
    this.successMessage = message;
    if (this.successTimer) {
      clearTimeout(this.successTimer);
    }
    this.successTimer = setTimeout(() => {
      this.successMessage = '';
      this.successTimer = null;
    }, 4200);
  }

  private loadLocations(): void {
    this.isLoadingLocations = true;
    this.locationsError = '';
    this.scheduleError = '';
    this.schedule = null;

    this.locationService.getLocations().subscribe({
      next: (locations) => {
        this.locations = locations;
        this.isLoadingLocations = false;
        if (locations.length === 0) {
          this.selectedLocationId = 0;
          return;
        }
        const stillValid = locations.some((location) => location.id === this.selectedLocationId);
        if (!stillValid) {
          this.selectedLocationId = locations[0].id;
        }
        this.loadSchedule();
      },
      error: (error: HttpErrorResponse) => {
        this.isLoadingLocations = false;
        this.locationsError = error.error?.message || 'Trenutno nije moguće učitati lokacije.';
      }
    });
  }

  private loadSchedule(): void {
    if (!this.selectedLocationId || !this.weekStart) {
      return;
    }

    this.isLoadingSchedule = true;
    this.scheduleError = '';

    this.portalService.getWeeklySchedule(this.selectedLocationId, this.weekStart).subscribe({
      next: (schedule) => {
        this.schedule = schedule;
        this.weekStart = schedule.weekStart;
        this.isLoadingSchedule = false;
      },
      error: (error: HttpErrorResponse) => {
        this.isLoadingSchedule = false;
        this.schedule = null;
        this.scheduleError = error.error?.message || 'Trenutno nije moguće učitati raspored.';
      }
    });
  }

  private formatWeekRange(from: string, to: string): string {
    if (!from || !to) {
      return '';
    }
    const fromYear = from.slice(0, 4);
    const toYear = to.slice(0, 4);
    if (fromYear === toYear) {
      return `${this.dayDateLabel(from)} - ${this.dayDateLabel(to)}${toYear}.`;
    }
    return `${this.dayDateLabel(from)}${fromYear}. - ${this.dayDateLabel(to)}${toYear}.`;
  }

  private clinicToday(): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Belgrade'
    }).format(new Date());
  }

  private mondayOf(isoDate: string): string {
    return this.addDay(isoDate, -(this.isoWeekday(isoDate) - 1));
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

  private hourOf(time: string): string {
    return time.slice(0, 2);
  }

  private minuteOf(time: string): string {
    const minute = time.slice(3, 5);
    return this.minuteOptions.includes(minute) ? minute : '00';
  }

  private dotDate(isoDate: string): string {
    const [year, month, day] = isoDate.split('-');
    return `${day}.${month}.${year}`;
  }
}
