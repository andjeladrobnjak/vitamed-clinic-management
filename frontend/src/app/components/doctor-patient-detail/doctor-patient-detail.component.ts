import { Component, OnInit, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DoctorAuthService } from '../../services/doctor-auth.service';
import {
  DoctorPortalPatientDetail,
  DoctorPortalService
} from '../../services/doctor-portal.service';
import { DoctorPortalHeaderComponent } from '../doctor-portal-header/doctor-portal-header.component';
import { formatSerbianNumericDate } from '../../utils/format-serbian-numeric-date';

@Component({
  selector: 'app-doctor-patient-detail',
  standalone: true,
  imports: [DoctorPortalHeaderComponent, RouterLink],
  templateUrl: './doctor-patient-detail.component.html',
  styleUrl: './doctor-patient-detail.component.css'
})
export class DoctorPatientDetailComponent implements OnInit {
  detail: DoctorPortalPatientDetail | null = null;
  isLoading = true;
  loadError = '';
  historyFilter: 'all' | 'own' = 'all';

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly portalService = inject(DoctorPortalService);
  private readonly doctorAuth = inject(DoctorAuthService);

  ngOnInit(): void {
    const patientId = Number(this.route.snapshot.paramMap.get('patientId'));
    this.loadPatient(patientId);
  }

  get fullName(): string {
    if (!this.detail) {
      return '';
    }
    return `${this.detail.patient.firstName} ${this.detail.patient.lastName}`.trim();
  }

  birthDateLabel(isoDate: string | null): string {
    return `Datum rođenja: ${formatSerbianNumericDate(isoDate)}`;
  }

  appointmentDateLabel(isoDate: string): string {
    return formatSerbianNumericDate(isoDate);
  }

  numericDate(isoDate: string | null): string {
    return formatSerbianNumericDate(isoDate);
  }

  doctorLabel(firstName: string, lastName: string): string {
    return `dr ${firstName} ${lastName}`.trim();
  }

  get visibleHistory() {
    const history = this.detail?.history ?? [];
    if (this.historyFilter === 'own') {
      return history.filter((item) => item.isOwnAppointment);
    }
    return history;
  }

  get showOwnHistoryEmpty(): boolean {
    return this.historyFilter === 'own'
      && (this.detail?.history.length ?? 0) > 0
      && this.visibleHistory.length === 0;
  }

  setHistoryFilter(filter: 'all' | 'own'): void {
    this.historyFilter = filter;
  }

  private loadPatient(patientId: number): void {
    this.isLoading = true;
    this.loadError = '';
    this.detail = null;
    this.historyFilter = 'all';

    this.portalService.getPatient(patientId).subscribe({
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
          this.loadError = error.error?.message || 'Pacijent nije pronađen.';
          return;
        }
        this.loadError = error.error?.message || 'Trenutno nije moguće učitati pacijenta.';
      }
    });
  }
}
