import { Component, OnInit, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DoctorAuthService } from '../../services/doctor-auth.service';
import {
  CompleteAppointmentReportInput,
  DoctorPortalAppointmentReport,
  DoctorPortalService
} from '../../services/doctor-portal.service';
import { DoctorPortalHeaderComponent } from '../doctor-portal-header/doctor-portal-header.component';
import {
  AppointmentReportModalComponent,
  ReportModalAppointment,
  ReportModalValues
} from '../doctor-portal/appointment-report-modal.component';
import { formatSerbianNumericDate } from '../../utils/format-serbian-numeric-date';

@Component({
  selector: 'app-doctor-appointment-report',
  standalone: true,
  imports: [DoctorPortalHeaderComponent, RouterLink, AppointmentReportModalComponent],
  templateUrl: './doctor-appointment-report.component.html',
  styleUrl: './doctor-appointment-report.component.css'
})
export class DoctorAppointmentReportComponent implements OnInit {
  detail: DoctorPortalAppointmentReport | null = null;
  isLoading = true;
  loadError = '';
  patientId: number | null = null;
  isEditing = false;
  isSaving = false;
  saveError = '';
  successMessage = '';
  editAppointment: ReportModalAppointment | null = null;
  editInitialReport: ReportModalValues | null = null;

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

  get canEdit(): boolean {
    if (!this.detail) {
      return false;
    }
    return this.detail.canEdit ?? this.detail.isOwnReport;
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

  openEdit(): void {
    if (!this.detail || !this.canEdit || this.isSaving) {
      return;
    }
    this.saveError = '';
    this.successMessage = '';
    this.editAppointment = {
      patient: {
        firstName: this.detail.patient.firstName,
        lastName: this.detail.patient.lastName
      },
      service: { name: this.detail.appointment.service.name },
      startTime: this.detail.appointment.startTime,
      endTime: this.detail.appointment.endTime
    };
    this.editInitialReport = {
      anamnesis: this.detail.report.anamnesis,
      findings: this.detail.report.findings,
      diagnosis: this.detail.report.diagnosis,
      therapyRecommendations: this.detail.report.therapyRecommendations
    };
    this.isEditing = true;
  }

  closeEdit(): void {
    if (this.isSaving) {
      return;
    }
    this.isEditing = false;
    this.saveError = '';
    this.editAppointment = null;
    this.editInitialReport = null;
  }

  submitEdit(report: CompleteAppointmentReportInput): void {
    if (!this.detail || !this.canEdit || this.isSaving) {
      return;
    }

    this.isSaving = true;
    this.saveError = '';
    this.successMessage = '';

    this.portalService
      .updateAppointmentReport(this.detail.patient.id, this.detail.appointment.id, report)
      .subscribe({
        next: (updated) => {
          const { message, ...detail } = updated;
          this.detail = detail;
          this.isSaving = false;
          this.isEditing = false;
          this.editAppointment = null;
          this.editInitialReport = null;
          this.successMessage = message || 'Izmene su uspešno sačuvane.';
        },
        error: (error: HttpErrorResponse) => {
          this.isSaving = false;
          if (error.status === 401) {
            this.doctorAuth.logout();
            void this.router.navigate(['/lekar/prijava']);
            return;
          }
          this.saveError = error.error?.message || 'Trenutno nije moguće sačuvati izveštaj.';
        }
      });
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
