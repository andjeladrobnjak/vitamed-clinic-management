import { Component } from '@angular/core';
import { DoctorPortalHeaderComponent } from '../doctor-portal-header/doctor-portal-header.component';

@Component({
  selector: 'app-doctor-schedule',
  standalone: true,
  imports: [DoctorPortalHeaderComponent],
  templateUrl: './doctor-schedule.component.html',
  styleUrl: './doctor-schedule.component.css'
})
export class DoctorScheduleComponent {}
