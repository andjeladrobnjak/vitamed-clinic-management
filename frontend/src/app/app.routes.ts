import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { PatientLoginComponent } from './components/patient-login/patient-login.component';
import { PatientRegisterComponent } from './components/patient-register/patient-register.component';
import { PatientDashboardComponent } from './components/patient-dashboard/patient-dashboard.component';
import { PatientAppointmentsComponent } from './components/patient-appointments/patient-appointments.component';
import { AppointmentHistoryComponent } from './components/appointment-history/appointment-history.component';
import { PatientAppointmentReportComponent } from './components/patient-appointment-report/patient-appointment-report.component';
import { PatientProfileComponent } from './components/patient-profile/patient-profile.component';
import { DoctorsComponent } from './components/doctors/doctors.component';
import { DoctorDetailComponent } from './components/doctor-detail/doctor-detail.component';
import { ClinicServicesComponent } from './components/clinic-services/clinic-services.component';
import { SpecialtyDetailComponent } from './components/specialty-detail/specialty-detail.component';
import { LocationsComponent } from './components/locations/locations.component';
import { AppointmentComponent } from './components/appointment/appointment.component';
import { patientAuthGuard } from './guards/patient-auth.guard';
import { doctorAuthGuard } from './guards/doctor-auth.guard';
import { adminAuthGuard } from './guards/admin-auth.guard';
import { DoctorLoginComponent } from './components/doctor-login/doctor-login.component';
import { AdminLoginComponent } from './components/admin-login/admin-login.component';
import { AdminShellComponent } from './components/admin-shell/admin-shell.component';
import { AdminPortalComponent } from './components/admin-portal/admin-portal.component';
import { AdminSectionComponent } from './components/admin-section/admin-section.component';
import { AdminStatisticsComponent } from './components/admin-statistics/admin-statistics.component';
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
    path: 'istorija-pregleda/:appointmentId',
    component: PatientAppointmentReportComponent,
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
  { path: 'admin/prijava', component: AdminLoginComponent },
  {
    path: 'admin',
    component: AdminShellComponent,
    canActivate: [adminAuthGuard],
    children: [
      { path: 'portal', component: AdminPortalComponent },
      {
        path: 'doctors',
        component: AdminSectionComponent,
        data: {
          heading: 'Lekari',
          lead: 'Upravljanje lekarima i njihovim nalogima biće dostupno u narednoj fazi.'
        }
      },
      {
        path: 'services',
        component: AdminSectionComponent,
        data: {
          heading: 'Usluge',
          lead: 'Upravljanje uslugama i pregledima biće dostupno u narednoj fazi.'
        }
      },
      {
        path: 'locations',
        component: AdminSectionComponent,
        data: {
          heading: 'Lokacije',
          lead: 'Upravljanje lokacijama klinike biće dostupno u narednoj fazi.'
        }
      },
      {
        path: 'appointments',
        component: AdminSectionComponent,
        data: {
          heading: 'Termini',
          lead: 'Pregled i upravljanje svim terminima biće dostupno u narednoj fazi.'
        }
      },
      {
        path: 'patients',
        component: AdminSectionComponent,
        data: {
          heading: 'Pacijenti',
          lead: 'Pregled registrovanih pacijenata biće dostupan u narednoj fazi.'
        }
      },
      { path: 'statistics', component: AdminStatisticsComponent },
      { path: '', pathMatch: 'full', redirectTo: 'portal' }
    ]
  },
];
