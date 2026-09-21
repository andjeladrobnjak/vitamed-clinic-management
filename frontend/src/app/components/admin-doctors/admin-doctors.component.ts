import { Component, OnInit, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { LucideChevronRight, LucidePlus, LucideSearch, LucideUser } from '@lucide/angular';
import { Doctor, DoctorService, Specialty } from '../../services/doctor.service';
import { resolveMediaUrl } from '../../utils/media-url';
import { VitamedSelectComponent, VitamedSelectOption } from '../vitamed-select/vitamed-select.component';

@Component({
  selector: 'app-admin-doctors',
  standalone: true,
  imports: [RouterLink, VitamedSelectComponent],
  templateUrl: './admin-doctors.component.html',
  styleUrl: './admin-doctors.component.css'
})
export class AdminDoctorsComponent implements OnInit {
  readonly searchIcon = LucideSearch.icon.node;
  readonly plusIcon = LucidePlus.icon.node;
  readonly chevronIcon = LucideChevronRight.icon.node;
  readonly userIcon = LucideUser.icon.node;
  readonly mediaUrl = resolveMediaUrl;

  doctors: Doctor[] = [];
  specialties: Specialty[] = [];
  searchQuery = '';
  selectedSpecialtyId = '';
  isLoading = true;
  loadError = '';
  page = 1;
  failedImages = new Set<number>();

  private readonly pageSize = 10;
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
        this.isLoading = false;
        this.loadError = error.error?.message || 'Trenutno nije moguće učitati lekare.';
      }
    });
  }

  onSearchInput(event: Event): void {
    this.searchQuery = (event.target as HTMLInputElement).value;
    this.page = 1;
  }

  get specialtyFilterOptions(): VitamedSelectOption<string>[] {
    return [
      { value: '', label: 'Sve specijalizacije' },
      ...this.specialties.map((specialty) => ({ value: String(specialty.id), label: specialty.name }))
    ];
  }

  onSpecialtyChange(value: string | number | boolean | null): void {
    this.selectedSpecialtyId = value == null ? '' : String(value);
    this.page = 1;
  }

  onImageError(doctorId: number): void {
    this.failedImages = new Set(this.failedImages).add(doctorId);
  }

  showPhoto(doctor: Doctor): boolean {
    return !!doctor.imageUrl && !this.failedImages.has(doctor.id);
  }

  doctorName(doctor: Doctor): string {
    return `dr ${doctor.firstName} ${doctor.lastName}`;
  }

  locationLabel(doctor: Doctor): string {
    return (doctor.locations ?? []).map((location) => location.name).join(' · ');
  }

  doctorCountLabel(count: number): string {
    const n = Math.abs(count) % 100;
    const last = n % 10;
    if (last === 1 && n !== 11) {
      return `${count} lekar`;
    }
    return `${count} lekara`;
  }

  get filteredDoctors(): Doctor[] {
    const query = this.searchQuery.trim().toLowerCase();
    const specialtyId = this.selectedSpecialtyId ? Number(this.selectedSpecialtyId) : null;

    return this.doctors.filter((doctor) => {
      if (specialtyId !== null && doctor.specialty.id !== specialtyId) {
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

  get filteredTotal(): number {
    return this.filteredDoctors.length;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredTotal / this.pageSize));
  }

  get pagedDoctors(): Doctor[] {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredDoctors.slice(start, start + this.pageSize);
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, index) => index + 1);
  }

  get showPagination(): boolean {
    return this.filteredTotal > this.pageSize;
  }

  get rangeStart(): number {
    if (this.filteredTotal === 0) {
      return 0;
    }
    return (this.page - 1) * this.pageSize + 1;
  }

  get rangeEnd(): number {
    return Math.min(this.page * this.pageSize, this.filteredTotal);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) {
      return;
    }
    this.page = page;
  }
}
