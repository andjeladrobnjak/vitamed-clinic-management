import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AvailabilityTimesResponse {
  date: string;
  doctorId: number;
  locationId: number;
  serviceId: number;
  availableTimes: string[];
}

export interface AvailableDatesResponse {
  from: string;
  to: string;
  availableDates: string[];
}

export interface UpcomingAppointment {
  id: number;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  service: { name: string };
  doctor: {
    firstName: string;
    lastName: string;
    specialty: { name: string };
  };
  location: {
    name: string;
    address: string;
    city: string;
  };
}

export interface UpcomingAppointmentResponse {
  appointment: UpcomingAppointment | null;
}

export interface AppointmentListResponse {
  appointments: UpcomingAppointment[];
}

export interface CreatedAppointmentResponse {
  id: number;
  status: 'confirmed';
  appointmentDate: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  email: string;
  registered: boolean;
  emailSent: boolean;
  service: { id: number; name: string };
  doctor: { id: number; firstName: string; lastName: string };
  location: {
    id: number;
    name: string;
    address: string;
    city: string;
    phone: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AppointmentAvailabilityApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:3000/api/appointments';

  getAvailableTimes(params: {
    doctorId: number;
    serviceId: number;
    locationId: number;
    date: string;
  }): Observable<AvailabilityTimesResponse> {
    return this.http.get<AvailabilityTimesResponse>(`${this.baseUrl}/availability`, {
      params: this.toParams(params)
    });
  }

  getAvailableDates(params: {
    doctorId: number;
    serviceId: number;
    locationId: number;
    from: string;
    to: string;
  }): Observable<AvailableDatesResponse> {
    return this.http.get<AvailableDatesResponse>(`${this.baseUrl}/available-dates`, {
      params: this.toParams(params)
    });
  }

  createAppointment(payload: {
    doctorId: number;
    serviceId: number;
    locationId: number;
    appointmentDate: string;
    startTime: string;
    firstName: string;
    lastName: string;
    jmbg: string;
    email: string;
    phone: string;
  }): Observable<CreatedAppointmentResponse> {
    return this.http.post<CreatedAppointmentResponse>(this.baseUrl, payload);
  }

  getUpcomingAppointment(): Observable<UpcomingAppointmentResponse> {
    return this.http.get<UpcomingAppointmentResponse>(`${this.baseUrl}/upcoming`);
  }

  getUpcomingAppointments(): Observable<AppointmentListResponse> {
    return this.http.get<AppointmentListResponse>(`${this.baseUrl}/upcoming/all`);
  }

  getAppointmentHistory(): Observable<AppointmentListResponse> {
    return this.http.get<AppointmentListResponse>(`${this.baseUrl}/history`);
  }

  cancelAppointment(id: number): Observable<{ cancelled: boolean }> {
    return this.http.patch<{ cancelled: boolean }>(`${this.baseUrl}/${id}/cancel`, {});
  }

  private toParams(values: Record<string, string | number>): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(values)) {
      params = params.set(key, String(value));
    }
    return params;
  }
}
