import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ClinicService } from './clinic-service.service';
import { CreatedAppointmentResponse } from './appointment-availability.service';

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

export type AdminDoctorAccountStatus = 'missing' | 'pending' | 'active';

export interface AdminDoctorAccount {
  status: AdminDoctorAccountStatus;
  email: string | null;
  mustChangePassword: boolean;
}

export interface AdminDoctorAccountProvisioned {
  message: string;
  account: AdminDoctorAccount;
  temporaryPassword: string;
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
  durationMinutes: number;
  price: number;
  description: string | null;
}

export interface AdminPatientLookup {
  found: boolean;
  patient: {
    firstName: string;
    lastName: string;
    jmbg: string;
    email: string;
    phone: string;
  } | null;
}

export interface AdminCreateAppointmentPayload {
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

export type AdminDoctorAbsenceReason = 'annual_leave' | 'sick_leave' | 'day_off' | 'other';

export interface AdminDoctorAbsence {
  id: number;
  doctorId: number;
  startDate: string;
  endDate: string;
  reason: AdminDoctorAbsenceReason;
  createdAt: string | null;
}

export type AdminWeeklyAbsenceReason = AdminDoctorAbsenceReason;

export interface AdminWeeklyScheduleEntry {
  doctorId: number;
  firstName: string;
  lastName: string;
  specialtyName: string;
  startTime: string;
  endTime: string;
  absenceReason: AdminWeeklyAbsenceReason | null;
  isException: boolean;
}

export interface AdminWeeklyScheduleDay {
  date: string;
  dayOfWeek: number;
  entries: AdminWeeklyScheduleEntry[];
}

export interface AdminWeeklySchedule {
  location: { id: number; name: string };
  weekStart: string;
  weekEnd: string;
  days: AdminWeeklyScheduleDay[];
}

export interface AdminScheduleShift {
  startTime: string;
  endTime: string;
  location: { id: number; name: string };
}

export interface AdminScheduleDayDetail {
  doctor: {
    id: number;
    firstName: string;
    lastName: string;
    specialtyName: string;
  };
  date: string;
  weekday: number;
  absent: boolean;
  absenceReason: AdminWeeklyAbsenceReason | null;
  regular: AdminScheduleShift | null;
  exception: AdminScheduleShift | null;
  effective: (AdminScheduleShift & { source: 'regular' | 'exception' }) | null;
  locations: { id: number; name: string }[];
  canEdit: boolean;
  canRestore: boolean;
}

export interface AdminEligibleExceptionDoctor {
  id: number;
  firstName: string;
  lastName: string;
  specialtyName: string;
}

export type AdminStatisticsPeriod = 'thisMonth' | 'thisYear' | 'last12months';

export interface AdminStatisticsPopularDoctor {
  id: number;
  firstName: string;
  lastName: string;
  specialtyName: string;
  count: number;
}

export interface AdminStatisticsPopularService {
  id: number;
  name: string;
  specialtyName: string;
  count: number;
}

export interface AdminStatisticsCountPoint {
  key: string;
  label: string;
  count: number;
}

export interface AdminStatisticsRatePoint {
  key: string;
  label: string;
  percent: number;
  cancelled: number;
  total: number;
}

export interface AdminStatisticsNamedCount {
  id: number;
  name: string;
  count: number;
  percent: number;
}

export interface AdminStatistics {
  period: AdminStatisticsPeriod;
  popularDoctors: {
    thisMonth: AdminStatisticsPopularDoctor | null;
    allTime: AdminStatisticsPopularDoctor | null;
  };
  popularServices: {
    thisMonth: AdminStatisticsPopularService | null;
    allTime: AdminStatisticsPopularService | null;
  };
  completedTrend: {
    granularity: 'day' | 'month';
    points: AdminStatisticsCountPoint[];
  };
  specialtyDemand: AdminStatisticsNamedCount[];
  locationDemand: AdminStatisticsNamedCount[];
  cancellationTrend: {
    granularity: 'day' | 'month';
    points: AdminStatisticsRatePoint[];
  };
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

  getDoctorAccount(id: number): Observable<AdminDoctorAccount> {
    return this.http.get<AdminDoctorAccount>(`${this.portalUrl}/doctors/${id}/account`);
  }

  suggestDoctorAccountEmail(id: number): Observable<{ email: string }> {
    return this.http.get<{ email: string }>(`${this.portalUrl}/doctors/${id}/account/email-suggestion`);
  }

  generateDoctorTemporaryPassword(id: number): Observable<{ password: string }> {
    return this.http.post<{ password: string }>(`${this.portalUrl}/doctors/${id}/account/temporary-password`, {});
  }

  createDoctorAccount(
    id: number,
    payload: { email: string; password: string }
  ): Observable<AdminDoctorAccountProvisioned> {
    return this.http.post<AdminDoctorAccountProvisioned>(`${this.portalUrl}/doctors/${id}/account`, payload);
  }

  resetDoctorPassword(id: number): Observable<AdminDoctorAccountProvisioned> {
    return this.http.post<AdminDoctorAccountProvisioned>(
      `${this.portalUrl}/doctors/${id}/account/reset-password`,
      {}
    );
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

  lookupPatientByJmbg(jmbg: string): Observable<AdminPatientLookup> {
    return this.http.get<AdminPatientLookup>(`${this.portalUrl}/patients/by-jmbg`, {
      params: { jmbg }
    });
  }

  createAppointment(payload: AdminCreateAppointmentPayload): Observable<CreatedAppointmentResponse> {
    return this.http.post<CreatedAppointmentResponse>(`${this.portalUrl}/appointments`, payload);
  }

  cancelAppointment(id: number): Observable<{ message: string; appointment: AdminAppointment }> {
    return this.http.patch<{ message: string; appointment: AdminAppointment }>(
      `${this.portalUrl}/appointments/${id}/cancel`,
      {}
    );
  }

  getDoctorAbsences(doctorId: number): Observable<{ absences: AdminDoctorAbsence[] }> {
    return this.http.get<{ absences: AdminDoctorAbsence[] }>(`${this.portalUrl}/doctors/${doctorId}/absences`);
  }

  getWeeklySchedule(locationId: number, weekStart: string): Observable<AdminWeeklySchedule> {
    return this.http.get<AdminWeeklySchedule>(`${this.portalUrl}/schedule`, {
      params: {
        locationId: String(locationId),
        weekStart
      }
    });
  }

  getScheduleDay(doctorId: number, date: string): Observable<AdminScheduleDayDetail> {
    return this.http.get<AdminScheduleDayDetail>(`${this.portalUrl}/doctors/${doctorId}/schedule-day`, {
      params: { date }
    });
  }

  getEligibleExceptionDoctors(
    locationId: number,
    date: string
  ): Observable<{ doctors: AdminEligibleExceptionDoctor[] }> {
    return this.http.get<{ doctors: AdminEligibleExceptionDoctor[] }>(
      `${this.portalUrl}/schedule/eligible-doctors`,
      { params: { locationId: String(locationId), date } }
    );
  }

  saveScheduleException(
    doctorId: number,
    date: string,
    payload: { startTime: string; endTime: string; locationId: number }
  ): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(
      `${this.portalUrl}/doctors/${doctorId}/schedule-exceptions/${date}`,
      payload
    );
  }

  deleteScheduleException(doctorId: number, date: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.portalUrl}/doctors/${doctorId}/schedule-exceptions/${date}`
    );
  }

  getStatistics(period: AdminStatisticsPeriod): Observable<AdminStatistics> {
    return this.http.get<AdminStatistics>(`${this.portalUrl}/statistics`, {
      params: { period }
    });
  }

  createDoctorAbsence(
    doctorId: number,
    payload: { startDate: string; endDate: string; reason: AdminDoctorAbsenceReason }
  ): Observable<AdminDoctorAbsence> {
    return this.http.post<AdminDoctorAbsence>(`${this.portalUrl}/doctors/${doctorId}/absences`, payload);
  }

  deleteDoctorAbsence(doctorId: number, absenceId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.portalUrl}/doctors/${doctorId}/absences/${absenceId}`);
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
