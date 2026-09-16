import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface DoctorDashboardPatient {
  id: number | null;
  firstName: string;
  lastName: string;
}

export interface DoctorDashboardAppointment {
  id: number;
  startTime: string;
  endTime: string;
  status: 'confirmed' | 'completed';
  patient: DoctorDashboardPatient;
  service: { id: number; name: string };
  location: { id: number; name: string };
}

export interface DoctorDashboard {
  today: {
    date: string;
    appointmentCount: number;
    nextAppointment: DoctorDashboardAppointment | null;
    appointments: DoctorDashboardAppointment[];
  };
}

@Injectable({
  providedIn: 'root'
})
export class DoctorPortalService {
  private readonly http = inject(HttpClient);
  private readonly dashboardUrl = 'http://localhost:3000/api/doctor-portal/dashboard';

  getDashboard(): Observable<DoctorDashboard> {
    return this.http.get<DoctorDashboard>(this.dashboardUrl);
  }
}
