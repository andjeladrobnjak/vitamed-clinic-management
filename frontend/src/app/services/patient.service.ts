import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface PatientRegisterRequest {
  firstName: string;
  lastName: string;
  jmbg: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

export interface PatientRegisterResponse {
  message: string;
  patientId: number;
}

@Injectable({
  providedIn: 'root'
})
export class PatientService {
  private readonly http = inject(HttpClient);
  private readonly registerUrl = 'http://localhost:3000/api/patients/register';

  register(data: PatientRegisterRequest): Observable<PatientRegisterResponse> {
    return this.http.post<PatientRegisterResponse>(this.registerUrl, data);
  }
}
