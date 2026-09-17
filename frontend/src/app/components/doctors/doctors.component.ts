import { Component, HostListener, inject, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LucideChevronDown, LucideSearch, LucideUser } from '@lucide/angular';
import { Doctor, DoctorService, Specialty } from '../../services/doctor.service';
import { doctorSpecialtyLabel } from '../../utils/specialty-label';
import { SiteHeaderComponent } from '../site-header/site-header.component';
import { DoctorRatingComponent } from '../doctor-rating/doctor-rating.component';
import { resolveMediaUrl } from '../../utils/media-url';

@Component({
  selector: 'app-doctors',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, SiteHeaderComponent, DoctorRatingComponent],
  templateUrl: './doctors.component.html',
  styleUrl: './doctors.component.css'
})
export class DoctorsComponent implements OnInit {
  readonly searchIcon = LucideSearch.icon.node;
  readonly userIcon = LucideUser.icon.node;
  readonly chevronDownIcon = LucideChevronDown.icon.node;
  readonly mediaUrl = resolveMediaUrl;

  doctors: Doctor[] = [];
  specialties: Specialty[] = [];
  searchQuery = '';
  selectedSpecialtyId = '';
  specialtyMenuOpen = false;
  isLoading = true;
  loadError = '';

  private readonly doctorService = inject(DoctorService);

  ngOnInit(): void {
    this.doctorService.getSpecialties().subscribe({
      next: (specialties) => {
        this.specialties = specialties;
      },
      error: (error: HttpErrorResponse) => {
        console.error('Greška pri učitavanju specijalizacija:', error);
      }
    });

    this.doctorService.getDoctors().subscribe({
      next: (doctors) => {
        this.doctors = doctors;
        this.isLoading = false;
      },
      error: (error: HttpErrorResponse) => {
        console.error('Greška pri učitavanju lekara:', error);
        this.isLoading = false;
        this.loadError = 'Trenutno nije moguće učitati podatke o lekarima. Pokušajte ponovo.';
      }
    });
  }

  onSearchInput(event: Event): void {
    this.searchQuery = (event.target as HTMLInputElement).value;
  }

  specialtyLabel(specialtyName: string): string {
    return doctorSpecialtyLabel(specialtyName);
  }

  get selectedSpecialtyLabel(): string {
    if (!this.selectedSpecialtyId) {
      return 'Sve specijalizacije';
    }

    const selected = this.specialties.find(
      (specialty) => String(specialty.id) === this.selectedSpecialtyId
    );

    return selected?.name ?? 'Sve specijalizacije';
  }

  toggleSpecialtyMenu(event: Event): void {
    event.stopPropagation();
    this.specialtyMenuOpen = !this.specialtyMenuOpen;
  }

  selectSpecialty(specialtyId: string): void {
    this.selectedSpecialtyId = specialtyId;
    this.specialtyMenuOpen = false;
  }

  closeSpecialtyMenu(): void {
    this.specialtyMenuOpen = false;
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeSpecialtyMenu();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeSpecialtyMenu();
  }

  get filteredDoctors(): Doctor[] {
    const query = this.searchQuery.trim().toLowerCase();
    const specialtyId = this.selectedSpecialtyId ? Number(this.selectedSpecialtyId) : null;

    return this.doctors.filter((doctor) => {
      const matchesSpecialty = specialtyId === null || doctor.specialty.id === specialtyId;
      if (!matchesSpecialty) {
        return false;
      }

      if (!query) {
        return true;
      }

      const firstName = doctor.firstName.toLowerCase();
      const lastName = doctor.lastName.toLowerCase();
      const fullName = `${firstName} ${lastName}`;

      return firstName.includes(query) || lastName.includes(query) || fullName.includes(query);
    });
  }

  get hasActiveFilters(): boolean {
    return this.searchQuery.trim().length > 0 || this.selectedSpecialtyId !== '';
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.selectedSpecialtyId = '';
    this.specialtyMenuOpen = false;
  }

  retryLoad(): void {
    this.isLoading = true;
    this.loadError = '';
    this.ngOnInit();
  }
}
