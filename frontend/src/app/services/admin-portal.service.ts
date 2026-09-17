import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ClinicService } from './clinic-service.service';

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

export interface AdminClinicServicePayload {
  name: string;
  specialtyId?: number;
  price: number;
  durationMinutes: number;
  description: string | null;
}

export interface AdminAppointment {
  id: number;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  status: string;
  patientFirstName: string;
  patientLastName: string;
  patientJmbg: string;
  patientEmail: string;
  patientPhone: string;
  doctor: { id: number; firstName: string; lastName: string };
  service: { id: number; name: string };
  location: { id: number; name: string };
  cancellable: boolean;
}

export interface AdminAppointmentList {
  items: AdminAppointment[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface AdminAppointmentListParams {
  search: string;
  date: string;
  status: string;
  doctorId: number | null;
  page: number;
  pageSize: number;
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

  createService(payload: AdminClinicServicePayload): Observable<ClinicService> {
    return this.http.post<ClinicService>(`${this.portalUrl}/services`, payload);
  }

  updateService(id: number, payload: AdminClinicServicePayload): Observable<ClinicService> {
    return this.http.put<ClinicService>(`${this.portalUrl}/services/${id}`, payload);
  }

  getAppointments(params: AdminAppointmentListParams): Observable<AdminAppointmentList> {
    return this.http.get<AdminAppointmentList>(`${this.portalUrl}/appointments`, { params: this.toParams(params) });
  }

  cancelAppointment(id: number): Observable<{ message: string; appointment: AdminAppointment }> {
    return this.http.patch<{ message: string; appointment: AdminAppointment }>(
      `${this.portalUrl}/appointments/${id}/cancel`,
      {}
    );
  }

  private toParams(params: AdminAppointmentListParams): Record<string, string> {
    const query: Record<string, string> = {
      page: String(params.page),
      pageSize: String(params.pageSize)
    };
    if (params.search) {
      query['search'] = params.search;
    }
    if (params.date) {
      query['date'] = params.date;
    }
    if (params.status) {
      query['status'] = params.status;
    }
    if (params.doctorId) {
      query['doctorId'] = String(params.doctorId);
    }
    return query;
  }
}
