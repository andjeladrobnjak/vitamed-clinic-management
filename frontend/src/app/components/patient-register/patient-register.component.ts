import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-patient-register',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './patient-register.component.html',
  styleUrl: './patient-register.component.css'
})
export class PatientRegisterComponent {
  passwordVisible = false;
  confirmPasswordVisible = false;

  togglePassword(): void {
    this.passwordVisible = !this.passwordVisible;
  }

  toggleConfirmPassword(): void {
    this.confirmPasswordVisible = !this.confirmPasswordVisible;
  }
}
