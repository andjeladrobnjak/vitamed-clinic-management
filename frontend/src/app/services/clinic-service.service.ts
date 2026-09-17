import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Specialty } from './doctor.service';

export interface ClinicService {
  id: number;
  name: string;
  description: string | null;
  price: number;
  durationMinutes: number;
  specialty: Specialty;
}

@Injectable({
  providedIn: 'root'
})
export class ClinicServiceApi {
  private readonly http = inject(HttpClient);
  private readonly servicesUrl = 'http://localhost:3000/api/services';

  getServices(specialtyId?: number): Observable<ClinicService[]> {
    const params = specialtyId ? { specialtyId: String(specialtyId) } : undefined;
    return this.http.get<ClinicService[]>(this.servicesUrl, { params });
  }
}
