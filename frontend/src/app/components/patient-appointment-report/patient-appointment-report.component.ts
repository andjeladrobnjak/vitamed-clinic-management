import { Component, OnInit, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import {
  AppointmentAvailabilityApi,
  PatientAppointmentReport
} from '../../services/appointment-availability.service';
import { SiteHeaderComponent } from '../site-header/site-header.component';

@Component({
  selector: 'app-patient-appointment-report',
  standalone: true,
  imports: [SiteHeaderComponent, RouterLink],
  templateUrl: './patient-appointment-report.component.html',
  styleUrls: ['../patient-portal/patient-portal-page.css', './patient-appointment-report.component.css']
})
export class PatientAppointmentReportComponent implements OnInit {
  detail: PatientAppointmentReport | null = null;
  isLoading = true;
  loadError = '';

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly appointmentApi = inject(AppointmentAvailabilityApi);
  private readonly authService = inject(AuthService);

  ngOnInit(): void {
    const appointmentId = Number(this.route.snapshot.paramMap.get('appointmentId'));
    this.loadReport(appointmentId);
  }

  therapyText(value: string | null): string {
    const text = value?.trim();
    return text ? text : 'Nisu navedene posebne preporuke.';
  }

  private loadReport(appointmentId: number): void {
    this.isLoading = true;
    this.loadError = '';
    this.detail = null;

    this.appointmentApi.getAppointmentReport(appointmentId).subscribe({
      next: (detail) => {
        this.detail = detail;
        this.isLoading = false;
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading = false;
        this.detail = null;
        if (error.status === 401) {
          this.authService.logout();
          void this.router.navigate(['/prijava']);
          return;
        }
        if (error.status === 404 || error.status === 400) {
          this.loadError = 'Izveštaj nije pronađen.';
          return;
        }
        this.loadError = 'Trenutno nije moguće učitati izveštaj.';
      }
    });
  }
}
