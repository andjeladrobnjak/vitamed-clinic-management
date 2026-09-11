import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { PatientLoginComponent } from './components/patient-login/patient-login.component';
import { PatientRegisterComponent } from './components/patient-register/patient-register.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'prijava', component: PatientLoginComponent },
  { path: 'registracija', component: PatientRegisterComponent },
];
