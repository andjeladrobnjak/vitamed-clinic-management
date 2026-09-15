import { Component, inject, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AppointmentAvailabilityApi, UpcomingAppointment } from '../../services/appointment-availability.service';
import { formatSerbianDate } from '../../utils/format-serbian-date';
import { SiteHeaderComponent } from '../site-header/site-header.component';

@Component({
  selector: 'app-appointment-history',
  standalone: true,
  imports: [SiteHeaderComponent],
  templateUrl: './appointment-history.component.html',
  styleUrls: ['../patient-portal/patient-portal-page.css', './appointment-history.component.css']
})
export class AppointmentHistoryComponent implements OnInit {
  appointments: UpcomingAppointment[] = [];
  isLoading = true;
  loadError = '';

  private readonly appointmentApi = inject(AppointmentAvailabilityApi);
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
