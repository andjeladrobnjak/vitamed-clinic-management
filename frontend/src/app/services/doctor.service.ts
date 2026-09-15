import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Specialty {
  id: number;
  name: string;
  slug?: string | null;
}

export interface Doctor {
  id: number;
  firstName: string;
  lastName: string;
  biography: string | null;
  imageUrl: string | null;
  specialty: Specialty;
}

export interface SpecialtyService {
  id: number;
  name: string;
  description: string | null;
  price: number;
  durationMinutes: number;
}

export interface SpecialtyDetail {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  services: SpecialtyService[];
  doctors: Doctor[];
}

@Injectable({
  providedIn: 'root'
})
export class DoctorService {
  private readonly http = inject(HttpClient);
  private readonly specialtiesUrl = 'http://localhost:3000/api/specialties';

  getSpecialties(): Observable<Specialty[]> {
    return this.http.get<Specialty[]>(this.specialtiesUrl);
  }

  getSpecialtyBySlug(slug: string): Observable<SpecialtyDetail> {
    return this.http.get<SpecialtyDetail>(`${this.specialtiesUrl}/${slug}`);
  }
}
