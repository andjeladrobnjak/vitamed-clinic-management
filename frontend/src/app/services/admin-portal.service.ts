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

export interface AdminDoctorSchedule {
  dayOfWeek: number;
  locationId: number | null;
  startTime: string;
  endTime: string;
  works?: boolean;
}

export interface AdminDoctorDetail {
  id: number;
  firstName: string;
  lastName: string;
  biography: string | null;
  education: string | null;
  professionalExperience: string | null;
  imageUrl: string | null;
  specialty: { id: number; name: string };
  locations: { id: number; name: string }[];
  services: { id: number; name: string }[];
  schedules: AdminDoctorSchedule[];
}

export interface AdminDoctorUpdatePayload {
  firstName: string;
  lastName: string;
  specialtyId: number;
  imageUrl: string | null;
  biography: string | null;
  education: string | null;
  professionalExperience: string | null;
  locationIds: number[];
  serviceIds: number[];
  schedules: AdminDoctorSchedule[];
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

  getDoctor(id: number): Observable<AdminDoctorDetail> {
    return this.http.get<AdminDoctorDetail>(`${this.portalUrl}/doctors/${id}`);
  }

  updateDoctor(id: number, payload: AdminDoctorUpdatePayload): Observable<AdminDoctorDetail> {
    return this.http.put<AdminDoctorDetail>(`${this.portalUrl}/doctors/${id}`, payload);
  }

  uploadDoctorImage(id: number, file: File): Observable<{ imageUrl: string }> {
    const body = new FormData();
    body.append('image', file);
    return this.http.post<{ imageUrl: string }>(`${this.portalUrl}/doctors/${id}/image`, body);
  }

  createDoctor(payload: AdminDoctorUpdatePayload): Observable<AdminDoctorDetail> {
    return this.http.post<AdminDoctorDetail>(`${this.portalUrl}/doctors`, payload);
  }
}
