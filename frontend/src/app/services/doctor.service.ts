import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Specialty {
  id: number;
  name: string;
  slug?: string | null;
}

export interface DoctorLocation {
  id: number;
  name: string;
  address?: string;
  city?: string;
  phone?: string;
  workingHours?: string;
}

export interface DoctorServiceRef {
  id: number;
  name: string;
}

export interface Doctor {
  id: number;
  firstName: string;
  lastName: string;
  biography: string | null;
  imageUrl: string | null;
  specialty: Specialty;
  locations?: DoctorLocation[];
  services?: DoctorServiceRef[];
  averageRating: number | null;
  reviewCount: number;
}

export interface SpecialtyService {
  id: number;
  name: string;
  description: string | null;
  price: number;
  durationMinutes: number;
}

export interface DoctorDetail {
  id: number;
  firstName: string;
  lastName: string;
  biography: string | null;
  education: string | null;
  professionalExperience: string | null;
  imageUrl: string | null;
  specialty: Specialty;
  averageRating: number | null;
  reviewCount: number;
  services: SpecialtyService[];
  locations: DoctorLocation[];
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
  private readonly doctorsUrl = 'http://localhost:3000/api/doctors';
  private readonly specialtiesUrl = 'http://localhost:3000/api/specialties';

  getDoctors(): Observable<Doctor[]> {
    return this.http.get<Doctor[]>(this.doctorsUrl);
  }

  getDoctorById(id: number): Observable<DoctorDetail> {
    return this.http.get<DoctorDetail>(`${this.doctorsUrl}/${id}`);
  }

  getSpecialties(): Observable<Specialty[]> {
    return this.http.get<Specialty[]>(this.specialtiesUrl);
  }

  getSpecialtyBySlug(slug: string): Observable<SpecialtyDetail> {
    return this.http.get<SpecialtyDetail>(`${this.specialtiesUrl}/${slug}`);
  }
}
