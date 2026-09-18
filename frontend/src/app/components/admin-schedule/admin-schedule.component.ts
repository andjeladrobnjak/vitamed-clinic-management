import { Component, OnInit, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { LucideCalendarOff } from '@lucide/angular';
import {
  AdminPortalService,
  AdminWeeklyAbsenceReason,
  AdminWeeklySchedule,
  AdminWeeklyScheduleEntry
} from '../../services/admin-portal.service';
import { ClinicLocation, LocationService } from '../../services/location.service';

@Component({
  selector: 'app-admin-schedule',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './admin-schedule.component.html',
  styleUrls: ['./admin-schedule.component.css', './admin-schedule-week.css']
})
export class AdminScheduleComponent implements OnInit {
  readonly weekdayLabels = ['PON', 'UTO', 'SRE', 'ČET', 'PET', 'SUB', 'NED'];
  readonly calendarOffIcon = LucideCalendarOff.icon.node;

  locations: ClinicLocation[] = [];
  selectedLocationId = 0;
  weekStart = '';
  schedule: AdminWeeklySchedule | null = null;
  isLoadingLocations = true;
  isLoadingSchedule = false;
  locationsError = '';
  scheduleError = '';

  private readonly portalService = inject(AdminPortalService);
  private readonly locationService = inject(LocationService);

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

  doctorLabel(entry: AdminWeeklyScheduleEntry): string {
    return `dr ${entry.firstName} ${entry.lastName}`.trim();
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

  onLocationChange(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    if (!Number.isInteger(value) || value <= 0 || value === this.selectedLocationId) {
      return;
    }
    this.selectedLocationId = value;
    this.loadSchedule();
  }

  previousWeek(): void {
    this.weekStart = this.addDay(this.weekStart, -7);
    this.loadSchedule();
  }

  nextWeek(): void {
    this.weekStart = this.addDay(this.weekStart, 7);
    this.loadSchedule();
  }

  goToToday(): void {
    const currentMonday = this.mondayOf(this.clinicToday());
    if (this.weekStart === currentMonday && this.schedule && !this.scheduleError) {
      return;
    }
    this.weekStart = currentMonday;
    this.loadSchedule();
  }

  retryLoad(): void {
    if (this.locationsError || this.locations.length === 0) {
      this.loadLocations();
      return;
    }
    this.loadSchedule();
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
}
