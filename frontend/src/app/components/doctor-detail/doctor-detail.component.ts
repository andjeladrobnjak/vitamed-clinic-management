import { Component, inject, OnDestroy } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink, RouterLinkActive } from '@angular/router';
import { Subscription } from 'rxjs';
import { LucideBriefcase, LucideClock, LucideGraduationCap, LucideMapPin, LucideUser } from '@lucide/angular';
import { DoctorDetail, DoctorService } from '../../services/doctor.service';
import { specialistTitle as specialtyRoleTitle } from '../../utils/specialty-label';
import { SiteHeaderComponent } from '../site-header/site-header.component';

@Component({
  selector: 'app-doctor-detail',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, SiteHeaderComponent],
  templateUrl: './doctor-detail.component.html',
  styleUrl: './doctor-detail.component.css'
})
export class DoctorDetailComponent implements OnDestroy {
  readonly userIcon = LucideUser.icon.node;
  readonly pinIcon = LucideMapPin.icon.node;
  readonly clockIcon = LucideClock.icon.node;
  readonly graduationIcon = LucideGraduationCap.icon.node;
  readonly briefcaseIcon = LucideBriefcase.icon.node;

  doctor: DoctorDetail | null = null;
  isLoading = true;
  notFound = false;
  loadError = '';

  private readonly route = inject(ActivatedRoute);
  private readonly doctorService = inject(DoctorService);
  private readonly subscriptions = new Subscription();

  constructor() {
    this.subscriptions.add(
      this.route.paramMap.subscribe((params) => {
        const id = Number(params.get('id'));
        this.loadDoctor(id);
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  retryLoad(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.loadDoctor(id);
  }

  specialistTitle(specialtyName: string): string {
    return specialtyRoleTitle(specialtyName);
  }

  formatPrice(price: number): string {
    return `${new Intl.NumberFormat('sr-RS', { maximumFractionDigits: 0 }).format(price)} RSD`;
  }

  formatDuration(minutes: number): string {
    return `${minutes} min`;
  }

  private loadDoctor(id: number): void {
    if (!Number.isInteger(id) || id <= 0) {
      this.isLoading = false;
      this.notFound = true;
      this.doctor = null;
      this.loadError = '';
      return;
    }

    this.isLoading = true;
    this.notFound = false;
    this.loadError = '';
    this.doctor = null;

    this.doctorService.getDoctorById(id).subscribe({
      next: (doctor) => {
        this.doctor = doctor;
        this.isLoading = false;
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading = false;
        this.doctor = null;
        if (error.status === 404) {
          this.notFound = true;
          return;
        }

        this.loadError = 'Trenutno nije moguće učitati podatke o lekaru. Pokušajte ponovo.';
      }
    });
  }
}
