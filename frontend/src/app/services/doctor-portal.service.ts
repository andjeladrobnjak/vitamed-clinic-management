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
  status: 'confirmed' | 'completed' | 'no_show';
  hasReport: boolean;
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

export interface DoctorPortalPatientListItem {
  id: number;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
}

export interface DoctorPortalPatientDetail {
  patient: {
    id: number;
    firstName: string;
    lastName: string;
    dateOfBirth: string | null;
    phone: string;
    email: string;
  };
  upcomingAppointment: {
    id: number;
    date: string;
    startTime: string;
    endTime: string;
    status: 'confirmed';
    service: { name: string };
    location: { name: string };
  } | null;
  history: Array<{
    id: number;
    date: string;
    startTime: string;
    endTime: string;
    status: 'completed';
    isOwnAppointment: boolean;
    hasReport: boolean;
    service: { name: string };
    doctor: { firstName: string; lastName: string };
    location: { name: string };
  }>;
}

export interface DoctorPortalAppointmentReport {
  patient: {
    id: number;
    firstName: string;
    lastName: string;
    dateOfBirth: string | null;
  };
  appointment: {
    id: number;
    date: string;
    startTime: string;
    endTime: string;
    status: 'completed';
    service: { name: string };
    location: { name: string };
  };
  doctor: {
    id: number;
    firstName: string;
    lastName: string;
    specialty: { name: string };
  };
  report: {
    id: number;
    anamnesis: string;
    findings: string;
    diagnosis: string;
    therapyRecommendations: string | null;
    createdAt: string;
    updatedAt: string;
  };
  isOwnReport: boolean;
  canEdit: boolean;
}

export interface DoctorPortalScheduleShift {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  location: { name: string };
}

export interface DoctorPortalScheduleAppointment {
  id: number;
  startTime: string;
  status: 'confirmed' | 'completed' | 'no_show';
  patient: {
    id: number | null;
    firstName: string;
    lastName: string;
  };
  service: { name: string };
}

export interface DoctorPortalScheduleDay {
  date: string;
  appointmentCount: number;
  appointments: DoctorPortalScheduleAppointment[];
}

export interface DoctorPortalMonthSchedule {
  year: number;
  month: number;
  from: string;
  to: string;
  shifts: DoctorPortalScheduleShift[];
  days: DoctorPortalScheduleDay[];
  absences: DoctorPortalScheduleAbsence[];
}

export interface DoctorPortalScheduleAbsence {
  id: number;
  startDate: string;
  endDate: string;
  reason: 'annual_leave' | 'sick_leave' | 'day_off' | 'other';
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

  getPatients(): Observable<{ patients: DoctorPortalPatientListItem[] }> {
    return this.http.get<{ patients: DoctorPortalPatientListItem[] }>(`${this.portalUrl}/patients`);
  }

  getPatient(patientId: number): Observable<DoctorPortalPatientDetail> {
    return this.http.get<DoctorPortalPatientDetail>(`${this.portalUrl}/patients/${patientId}`);
  }

  getAppointmentReport(
    patientId: number,
    appointmentId: number
  ): Observable<DoctorPortalAppointmentReport> {
    return this.http.get<DoctorPortalAppointmentReport>(
      `${this.portalUrl}/patients/${patientId}/appointments/${appointmentId}/report`
    );
  }

  updateAppointmentReport(
    patientId: number,
    appointmentId: number,
    report: CompleteAppointmentReportInput
  ): Observable<{ message: string } & DoctorPortalAppointmentReport> {
    return this.http.put<{ message: string } & DoctorPortalAppointmentReport>(
      `${this.portalUrl}/patients/${patientId}/appointments/${appointmentId}/report`,
      report
    );
  }

  markAppointmentNoShow(appointmentId: number): Observable<{
    message: string;
    appointment: {
      id: number;
      status: 'no_show';
      startTime: string;
      endTime: string;
    };
  }> {
    return this.http.patch<{
      message: string;
      appointment: {
        id: number;
        status: 'no_show';
        startTime: string;
        endTime: string;
      };
    }>(`${this.portalUrl}/appointments/${appointmentId}/no-show`, {});
  }

  getMonthSchedule(year: number, month: number): Observable<DoctorPortalMonthSchedule> {
    return this.http.get<DoctorPortalMonthSchedule>(`${this.portalUrl}/schedule`, {
      params: {
        year: String(year),
        month: String(month)
      }
    });
  }

  cancelAppointment(appointmentId: number): Observable<{
    message: string;
    cancelled: boolean;
    emailSent: boolean;
    appointment: {
      id: number;
      status: 'cancelled';
      cancelledBy: 'doctor';
    };
  }> {
    return this.http.patch<{
      message: string;
      cancelled: boolean;
      emailSent: boolean;
      appointment: {
        id: number;
        status: 'cancelled';
        cancelledBy: 'doctor';
      };
    }>(`${this.portalUrl}/appointments/${appointmentId}/cancel`, {});
  }
}
