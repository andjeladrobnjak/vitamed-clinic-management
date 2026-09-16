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

export interface CompleteAppointmentReportInput {
  anamnesis: string;
  findings: string;
  diagnosis: string;
  therapyRecommendations?: string;
}

export interface CompletedAppointment {
  message: string;
  appointment: {
    id: number;
    status: 'completed';
    startTime: string;
    endTime: string;
  };
  report: {
    id: number;
    appointmentId: number;
    anamnesis: string;
    findings: string;
    diagnosis: string;
    therapyRecommendations: string | null;
  };
}

@Injectable({
  providedIn: 'root'
})
export class DoctorPortalService {
  private readonly http = inject(HttpClient);
  private readonly portalUrl = 'http://localhost:3000/api/doctor-portal';

  getDashboard(): Observable<DoctorDashboard> {
    return this.http.get<DoctorDashboard>(`${this.portalUrl}/dashboard`);
  }

  completeAppointment(
    appointmentId: number,
    report: CompleteAppointmentReportInput
  ): Observable<CompletedAppointment> {
    return this.http.post<CompletedAppointment>(
      `${this.portalUrl}/appointments/${appointmentId}/complete`,
      report
    );
  }
}
