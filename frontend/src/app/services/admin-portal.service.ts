import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AdminDashboardAppointment {
  id: number;
  startTime: string;
  endTime: string;
  status: string;
  patientName: string;
  doctorName: string;
  serviceName: string;
  locationName: string;
}

export interface AdminDashboard {
  date: string;
  counts: {
    doctors: number;
    patients: number;
    todayAppointments: number;
    upcomingAppointments: number;
  };
  todayAppointments: AdminDashboardAppointment[];
  todayAppointmentTotal: number;
}

@Injectable({
  providedIn: 'root'
})
export class AdminPortalService {
  private readonly http = inject(HttpClient);
  private readonly portalUrl = 'http://localhost:3000/api/admin-portal';

  getDashboard(): Observable<AdminDashboard> {
    return this.http.get<AdminDashboard>(`${this.portalUrl}/dashboard`);
  }
}
