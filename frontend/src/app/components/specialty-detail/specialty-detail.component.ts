import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink, RouterLinkActive } from '@angular/router';
import { Subscription } from 'rxjs';
import { LucideUser } from '@lucide/angular';
import { DoctorService, SpecialtyDetail } from '../../services/doctor.service';
import { doctorSpecialtyLabel } from '../../utils/specialty-label';
import { SiteHeaderComponent } from '../site-header/site-header.component';
import { DoctorRatingComponent } from '../doctor-rating/doctor-rating.component';
import { resolveMediaUrl } from '../../utils/media-url';

@Component({
  selector: 'app-specialty-detail',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, SiteHeaderComponent, DoctorRatingComponent],
  templateUrl: './specialty-detail.component.html',
  styleUrl: './specialty-detail.component.css'
})
export class SpecialtyDetailComponent implements OnInit, OnDestroy {
  readonly userIcon = LucideUser.icon.node;
  readonly mediaUrl = resolveMediaUrl;

  detail: SpecialtyDetail | null = null;
  isLoading = true;
  notFound = false;
  loadError = '';
  highlightedServiceId: number | null = null;

  private readonly route = inject(ActivatedRoute);
  private readonly doctorService = inject(DoctorService);
  private readonly subscriptions = new Subscription();

  ngOnInit(): void {
    this.subscriptions.add(
      this.route.paramMap.subscribe((params) => {
        const slug = params.get('slug') ?? '';
        this.loadSpecialty(slug);
      })
    );

    this.subscriptions.add(
      this.route.queryParamMap.subscribe((params) => {
        const serviceId = Number(params.get('service'));
        this.highlightedServiceId = Number.isFinite(serviceId) && serviceId > 0 ? serviceId : null;
        if (this.detail && this.highlightedServiceId) {
          this.revealHighlightedService();
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  retryLoad(): void {
    const slug = this.route.snapshot.paramMap.get('slug') ?? '';
    this.loadSpecialty(slug);
  }

  specialtyLabel(specialtyName: string): string {
    return doctorSpecialtyLabel(specialtyName);
  }

  formatPrice(price: number): string {
    return `${new Intl.NumberFormat('sr-RS', { maximumFractionDigits: 0 }).format(price)} RSD`;
  }

  formatDuration(minutes: number): string {
    return `${minutes} min`;
  }

  private loadSpecialty(slug: string): void {
    this.isLoading = true;
    this.notFound = false;
    this.loadError = '';
    this.detail = null;

    this.doctorService.getSpecialtyBySlug(slug).subscribe({
      next: (detail) => {
        this.detail = detail;
        this.isLoading = false;
        this.revealHighlightedService();
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading = false;
        this.detail = null;
        if (error.status === 404) {
          this.notFound = true;
          return;
        }

        this.loadError = 'Trenutno nije moguće učitati specijalizaciju. Pokušajte ponovo.';
      }
    });
  }

  private revealHighlightedService(): void {
    if (this.highlightedServiceId === null) {
      return;
    }

    setTimeout(() => {
      const target = document.getElementById(`service-${this.highlightedServiceId}`);
      target?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }, 0);
  }
}
