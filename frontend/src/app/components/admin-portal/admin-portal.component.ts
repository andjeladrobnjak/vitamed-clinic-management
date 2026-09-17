import { Component, OnInit, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import {
  LucideCalendarClock,
  LucideCalendarDays,
  LucideStethoscope,
  LucideUsers
} from '@lucide/angular';
import { AdminAuthService } from '../../services/admin-auth.service';
import {
  AdminDashboard,
  AdminDashboardAppointment,
  AdminPortalService
} from '../../services/admin-portal.service';

type AppointmentStatusFilter = '' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

@Component({
  selector: 'app-admin-portal',
  standalone: true,
  templateUrl: './admin-portal.component.html',
  styleUrl: './admin-portal.component.css'
})
export class AdminPortalComponent implements OnInit {
  readonly stethoscopeIcon = LucideStethoscope.icon.node;
  readonly usersIcon = LucideUsers.icon.node;
  readonly calendarDaysIcon = LucideCalendarDays.icon.node;
  readonly calendarClockIcon = LucideCalendarClock.icon.node;

  dashboard: AdminDashboard | null = null;
  isLoading = true;
  loadError = '';
  statusFilter: AppointmentStatusFilter = '';
  page = 1;

  private readonly pageSize = 10;
  private readonly portalService = inject(AdminPortalService);
  private readonly adminAuth = inject(AdminAuthService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    this.portalService.getDashboard().subscribe({
      next: (dashboard) => {
        this.dashboard = dashboard;
        this.isLoading = false;
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading = false;
        if (error.status === 401) {
          this.adminAuth.logout();
          void this.router.navigate(['/admin/prijava']);
          return;
        }
        this.loadError = error.error?.message || 'Trenutno nije moguće učitati pregled.';
      }
    });
  }

  statusLabel(status: string): string {
    if (status === 'completed') {
      return 'Završeno';
    }
    if (status === 'cancelled') {
      return 'Otkazano';
    }
    if (status === 'no_show') {
      return 'Nije se pojavio';
    }
    return 'Zakazano';
  }

  statusClass(status: string): string {
    if (status === 'completed') {
      return 'is-completed';
    }
    if (status === 'cancelled') {
      return 'is-cancelled';
    }
    if (status === 'no_show') {
      return 'is-no-show';
    }
    return 'is-confirmed';
  }

  countValue(
    key: 'doctors' | 'patients' | 'todayAppointments' | 'upcomingAppointments'
  ): string {
    if (!this.dashboard) {
      return '';
    }
    return String(this.dashboard.counts[key]);
  }

  get todayTotal(): number {
    return this.dashboard?.todayAppointments.length ?? 0;
  }

  get filteredAppointments(): AdminDashboardAppointment[] {
    const appointments = this.dashboard?.todayAppointments ?? [];
    if (!this.statusFilter) {
      return appointments;
    }
    return appointments.filter((appointment) => appointment.status === this.statusFilter);
  }

  get filteredTotal(): number {
    return this.filteredAppointments.length;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredTotal / this.pageSize));
  }

  get pagedAppointments(): AdminDashboardAppointment[] {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredAppointments.slice(start, start + this.pageSize);
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, index) => index + 1);
  }

  get rangeStart(): number {
    if (this.filteredTotal === 0) {
      return 0;
    }
    return (this.page - 1) * this.pageSize + 1;
  }

  get rangeEnd(): number {
    return Math.min(this.page * this.pageSize, this.filteredTotal);
  }

  get showPagination(): boolean {
    return this.filteredTotal > this.pageSize;
  }

  onStatusFilterChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.statusFilter = value as AppointmentStatusFilter;
    this.page = 1;
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) {
      return;
    }
    this.page = page;
  }
}
