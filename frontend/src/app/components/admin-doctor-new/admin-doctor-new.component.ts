import { Component } from '@angular/core';
import { AdminDoctorDetailComponent } from '../admin-doctor-detail/admin-doctor-detail.component';

@Component({
  selector: 'app-admin-doctor-new',
  standalone: true,
  imports: [AdminDoctorDetailComponent],
  template: '<app-admin-doctor-detail [createMode]="true" />'
})
export class AdminDoctorNewComponent {}
