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

export interface PatientLoginRequest {
  email: string;
  password: string;
}

export interface PatientLoginResponse {
  message: string;
  token: string;
  patient: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface PatientProfile {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  jmbg?: string;
  phone?: string;
}

export interface PatientProfileUpdate {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

@Injectable({
  providedIn: 'root'
})
export class PatientService {
  private readonly http = inject(HttpClient);
  private readonly registerUrl = 'http://localhost:3000/api/patients/register';
  private readonly loginUrl = 'http://localhost:3000/api/patients/login';
  private readonly meUrl = 'http://localhost:3000/api/patients/me';

  register(data: PatientRegisterRequest): Observable<PatientRegisterResponse> {
    return this.http.post<PatientRegisterResponse>(this.registerUrl, data);
  }

  login(data: PatientLoginRequest): Observable<PatientLoginResponse> {
    return this.http.post<PatientLoginResponse>(this.loginUrl, data);
  }

  getMe(): Observable<PatientProfile> {
    return this.http.get<PatientProfile>(this.meUrl);
  }

  updateMe(data: PatientProfileUpdate): Observable<PatientProfile> {
    return this.http.patch<PatientProfile>(this.meUrl, data);
  }
}
