import { Component, HostListener, inject, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { LucideCalendar, LucideSearch, LucideUser } from '@lucide/angular';
import { AuthService } from '../../services/auth.service';
import { PatientService } from '../../services/patient.service';

@Component({
  selector: 'app-patient-dashboard',
  standalone: true,
  imports: [RouterLink],
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
  accountMenuOpen = false;

  private readonly patientService = inject(PatientService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  ngOnInit(): void {
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
        this.loadError = 'Podaci trenutno nisu dostupni. Pokušajte ponovo.';
      }
    });
  }

  toggleAccountMenu(event: Event): void {
    event.stopPropagation();
    this.accountMenuOpen = !this.accountMenuOpen;
  }

  closeAccountMenu(): void {
    this.accountMenuOpen = false;
  }

  logout(): void {
    this.accountMenuOpen = false;
    this.authService.logout();
    void this.router.navigate(['/']);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.accountMenuOpen = false;
  }
}
