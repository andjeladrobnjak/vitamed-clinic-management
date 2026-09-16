import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { PatientLoginComponent } from './components/patient-login/patient-login.component';
import { PatientRegisterComponent } from './components/patient-register/patient-register.component';
import { PatientDashboardComponent } from './components/patient-dashboard/patient-dashboard.component';
import { PatientAppointmentsComponent } from './components/patient-appointments/patient-appointments.component';
import { AppointmentHistoryComponent } from './components/appointment-history/appointment-history.component';
import { PatientProfileComponent } from './components/patient-profile/patient-profile.component';
import { DoctorsComponent } from './components/doctors/doctors.component';
import { DoctorDetailComponent } from './components/doctor-detail/doctor-detail.component';
import { ClinicServicesComponent } from './components/clinic-services/clinic-services.component';
import { SpecialtyDetailComponent } from './components/specialty-detail/specialty-detail.component';
import { LocationsComponent } from './components/locations/locations.component';
import { AppointmentComponent } from './components/appointment/appointment.component';
import { patientAuthGuard } from './guards/patient-auth.guard';
import { doctorAuthGuard } from './guards/doctor-auth.guard';
import { DoctorLoginComponent } from './components/doctor-login/doctor-login.component';
import { DoctorPortalComponent } from './components/doctor-portal/doctor-portal.component';
import { DoctorScheduleComponent } from './components/doctor-schedule/doctor-schedule.component';
import { DoctorPatientsComponent } from './components/doctor-patients/doctor-patients.component';
import { DoctorPatientDetailComponent } from './components/doctor-patient-detail/doctor-patient-detail.component';
import {
  DoctorAppointmentReportComponent
} from './components/doctor-appointment-report/doctor-appointment-report.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'prijava', component: PatientLoginComponent },
  { path: 'registracija', component: PatientRegisterComponent },
  { path: 'lekari', component: DoctorsComponent },
  { path: 'lekari/:id', component: DoctorDetailComponent },
  { path: 'usluge', component: ClinicServicesComponent },
  { path: 'usluge/:slug', component: SpecialtyDetailComponent },
  { path: 'lokacije', component: LocationsComponent },
  { path: 'appointment', component: AppointmentComponent },
  {
    path: 'moj-vitamed',
    component: PatientDashboardComponent,
    canActivate: [patientAuthGuard]
  },
  {
    path: 'moji-termini',
    component: PatientAppointmentsComponent,
    canActivate: [patientAuthGuard]
  },
  {
    path: 'istorija-pregleda',
    component: AppointmentHistoryComponent,
    canActivate: [patientAuthGuard]
  },
  {
    path: 'moj-profil',
    component: PatientProfileComponent,
    canActivate: [patientAuthGuard]
  },
  { path: 'lekar/prijava', component: DoctorLoginComponent },
  {
    path: 'lekar/portal',
    component: DoctorPortalComponent,
    canActivate: [doctorAuthGuard]
  },
  {
    path: 'lekar/raspored',
    component: DoctorScheduleComponent,
    canActivate: [doctorAuthGuard]
  },
  {
    path: 'lekar/pacijenti',
    component: DoctorPatientsComponent,
    canActivate: [doctorAuthGuard]
  },
  {
    path: 'lekar/pacijenti/:patientId/pregledi/:appointmentId',
    component: DoctorAppointmentReportComponent,
    canActivate: [doctorAuthGuard]
  },
  {
    path: 'lekar/pacijenti/:patientId',
    component: DoctorPatientDetailComponent,
    canActivate: [doctorAuthGuard]
  },
];
