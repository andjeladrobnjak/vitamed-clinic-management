import { Component, OnInit, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { LucideChevronRight, LucideSearch } from '@lucide/angular';
import { DoctorAuthService } from '../../services/doctor-auth.service';
import {
  DoctorPortalPatientListItem,
  DoctorPortalService
} from '../../services/doctor-portal.service';
import { DoctorPortalHeaderComponent } from '../doctor-portal-header/doctor-portal-header.component';
import { formatSerbianNumericDate, patientInitials } from '../../utils/format-serbian-numeric-date';

@Component({
  selector: 'app-doctor-patients',
  standalone: true,
  imports: [DoctorPortalHeaderComponent, RouterLink],
  templateUrl: './doctor-patients.component.html',
  styleUrl: './doctor-patients.component.css'
})
export class DoctorPatientsComponent implements OnInit {
  readonly chevronIcon = LucideChevronRight.icon.node;
  readonly searchIcon = LucideSearch.icon.node;
  patients: DoctorPortalPatientListItem[] = [];
  searchQuery = '';
  isLoading = true;
  loadError = '';

  private readonly portalService = inject(DoctorPortalService);
  private readonly doctorAuth = inject(DoctorAuthService);
  private readonly router = inject(Router);

  get filteredPatients(): DoctorPortalPatientListItem[] {
    const query = this.normalize(this.searchQuery);
    if (!query) {
      return this.patients;
    }

    return this.patients.filter((patient) => {
      const first = this.normalize(patient.firstName);
      const last = this.normalize(patient.lastName);
      const full = `${first} ${last}`;
      const reversed = `${last} ${first}`;
      return first.includes(query) || last.includes(query) || full.includes(query) || reversed.includes(query);
    });
  }

  get showEmptyDirectory(): boolean {
    return !this.isLoading && !this.loadError && this.patients.length === 0;
  }

  get showEmptySearch(): boolean {
    return !this.isLoading && !this.loadError && this.patients.length > 0 && this.filteredPatients.length === 0;
  }

  ngOnInit(): void {
    this.loadPatients();
  }

  onSearchInput(event: Event): void {
    this.searchQuery = (event.target as HTMLInputElement).value;
  }

  initials(patient: DoctorPortalPatientListItem): string {
    return patientInitials(patient.firstName, patient.lastName);
  }

  fullName(patient: DoctorPortalPatientListItem): string {
    return `${patient.firstName} ${patient.lastName}`.trim();
  }

  birthDateLabel(patient: DoctorPortalPatientListItem): string {
    return `Datum rođenja: ${formatSerbianNumericDate(patient.dateOfBirth)}`;
  }

  private loadPatients(): void {
    this.isLoading = true;
    this.loadError = '';

    this.portalService.getPatients().subscribe({
      next: (response) => {
        this.patients = response.patients;
        this.isLoading = false;
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading = false;
        this.patients = [];
        if (error.status === 401) {
          this.doctorAuth.logout();
          void this.router.navigate(['/lekar/prijava']);
          return;
        }
        this.loadError = error.error?.message || 'Trenutno nije moguće učitati pacijente.';
      }
    });
  }

  private normalize(value: string): string {
    return value.trim().toLocaleLowerCase('sr-Latn');
  }
}
