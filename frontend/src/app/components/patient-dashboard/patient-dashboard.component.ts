import { Component, inject, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { LucideCalendar, LucideSearch, LucideUser } from '@lucide/angular';
import { AuthService } from '../../services/auth.service';
import { PatientService } from '../../services/patient.service';
import { SiteHeaderComponent } from '../site-header/site-header.component';

@Component({
  selector: 'app-patient-dashboard',
  standalone: true,
  imports: [RouterLink, SiteHeaderComponent],
  templateUrl: './patient-dashboard.component.html',
  styleUrl: './patient-dashboard.component.css'
})
export class PatientDashboardComponent implements OnInit {
  readonly calendarIcon = LucideCalendar.icon.node;
  readonly searchIcon = LucideSearch.icon.node;
  readonly userIcon = LucideUser.icon.node;

  firstName = '';
  isLoading = true;
  loadError = '';

  private readonly patientService = inject(PatientService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    const sessionPatient = this.authService.patient();
    if (sessionPatient?.firstName) {
      this.firstName = sessionPatient.firstName;
      this.isLoading = false;
    }

    this.patientService.getMe().subscribe({
      next: (patient) => {
        this.firstName = patient.firstName;
        this.isLoading = false;
      },
      error: (error: HttpErrorResponse) => {
        if (error.status === 401) {
          this.authService.logout();
          void this.router.navigate(['/prijava']);
          return;
        }

        this.isLoading = false;
        if (!this.firstName) {
          this.loadError = 'Podaci trenutno nisu dostupni. Pokušajte ponovo.';
        }
      }
    });
  }
}
