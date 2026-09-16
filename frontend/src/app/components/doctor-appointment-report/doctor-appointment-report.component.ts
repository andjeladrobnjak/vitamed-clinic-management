import { Component, OnInit, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DoctorAuthService } from '../../services/doctor-auth.service';
import {
  DoctorPortalAppointmentReport,
  DoctorPortalService
} from '../../services/doctor-portal.service';
import { DoctorPortalHeaderComponent } from '../doctor-portal-header/doctor-portal-header.component';
import { formatSerbianNumericDate } from '../../utils/format-serbian-numeric-date';

@Component({
  selector: 'app-doctor-appointment-report',
  standalone: true,
  imports: [DoctorPortalHeaderComponent, RouterLink],
  templateUrl: './doctor-appointment-report.component.html',
  styleUrl: './doctor-appointment-report.component.css'
})
export class DoctorAppointmentReportComponent implements OnInit {
  detail: DoctorPortalAppointmentReport | null = null;
  isLoading = true;
  loadError = '';
  patientId: number | null = null;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly portalService = inject(DoctorPortalService);
  private readonly doctorAuth = inject(DoctorAuthService);

  ngOnInit(): void {
    const patientId = Number(this.route.snapshot.paramMap.get('patientId'));
    const appointmentId = Number(this.route.snapshot.paramMap.get('appointmentId'));
    this.patientId = Number.isInteger(patientId) && patientId > 0 ? patientId : null;
    this.loadReport(patientId, appointmentId);
  }

  get patientName(): string {
    if (!this.detail) {
      return '';
    }
    return `${this.detail.patient.firstName} ${this.detail.patient.lastName}`.trim();
  }

  get backLabel(): string {
    if (this.detail) {
      return `← Nazad na ${this.patientName}`;
    }
    return '← Nazad na pacijenta';
  }

  doctorLabel(firstName: string, lastName: string): string {
    return `dr ${firstName} ${lastName}`.trim();
  }

  numericDate(isoDate: string | null): string {
    return formatSerbianNumericDate(isoDate);
  }

  appointmentWhen(isoDate: string, startTime: string, endTime: string): string {
    return `${this.numericDate(isoDate)} · ${startTime}–${endTime}`;
  }

  therapyText(value: string | null): string {
    const text = value?.trim();
    return text ? text : 'Nisu navedene posebne preporuke.';
  }

  private loadReport(patientId: number, appointmentId: number): void {
    this.isLoading = true;
    this.loadError = '';
    this.detail = null;

    this.portalService.getAppointmentReport(patientId, appointmentId).subscribe({
      next: (detail) => {
        this.detail = detail;
        this.isLoading = false;
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading = false;
        this.detail = null;
        if (error.status === 401) {
          this.doctorAuth.logout();
          void this.router.navigate(['/lekar/prijava']);
          return;
        }
        if (error.status === 404 || error.status === 400) {
          this.loadError = error.error?.message || 'Izveštaj nije pronađen.';
          return;
        }
        this.loadError = error.error?.message || 'Trenutno nije moguće učitati izveštaj.';
      }
    });
  }
}
