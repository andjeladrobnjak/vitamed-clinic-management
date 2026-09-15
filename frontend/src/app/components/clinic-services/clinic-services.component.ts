import { Component, inject, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { DoctorService, Specialty } from '../../services/doctor.service';
import { SpecialtyIconComponent, SpecialtyIconName } from '../specialty-icon/specialty-icon.component';
import { slugFromSpecialtyName } from '../../utils/specialty-slug';
import { SiteHeaderComponent } from '../site-header/site-header.component';

const SPECIALTY_ORDER = [
  'Kardiologija',
  'Pulmologija',
  'Endokrinologija',
  'Ginekologija',
  'Pedijatrija',
  'Oftalmologija',
  'Otorinolaringologija (ORL)',
  'Hirurgija'
];

const SPECIALTY_ICONS: Record<string, SpecialtyIconName> = {
  Kardiologija: 'cardiology',
  Pulmologija: 'pulmonology',
  Endokrinologija: 'endocrinology',
  Ginekologija: 'ginecology',
  Pedijatrija: 'pediatry',
  Oftalmologija: 'oftalmology',
  'Otorinolaringologija (ORL)': 'otorinolaringology',
  Hirurgija: 'hirurgy'
};

@Component({
  selector: 'app-clinic-services',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, SpecialtyIconComponent, SiteHeaderComponent],
  templateUrl: './clinic-services.component.html',
  styleUrl: './clinic-services.component.css'
})
export class ClinicServicesComponent implements OnInit {
  specialties: Specialty[] = [];
  isLoading = true;
  loadError = '';

  private readonly doctorService = inject(DoctorService);

  ngOnInit(): void {
    this.doctorService.getSpecialties().subscribe({
      next: (specialties) => {
        this.specialties = [...specialties].sort((a, b) => {
          const indexA = SPECIALTY_ORDER.indexOf(a.name);
          const indexB = SPECIALTY_ORDER.indexOf(b.name);
          return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
        });
        this.isLoading = false;
      },
      error: (error: HttpErrorResponse) => {
        console.error('Greška pri učitavanju specijalizacija:', error);
        this.isLoading = false;
        this.loadError = 'Trenutno nije moguće učitati usluge. Pokušajte ponovo.';
      }
    });
  }

  iconForSpecialty(name: string): SpecialtyIconName {
    return SPECIALTY_ICONS[name] ?? 'cardiology';
  }

  specialtySlug(specialty: Specialty): string | null {
    return specialty.slug ?? slugFromSpecialtyName(specialty.name);
  }

  retryLoad(): void {
    this.isLoading = true;
    this.loadError = '';
    this.ngOnInit();
  }
}
