import { Injectable, computed, inject, signal } from '@angular/core';
import { PatientProfile, PatientService } from './patient.service';

const TOKEN_KEY = 'vitamed_patient_token';

interface PatientTokenPayload {
  patientId?: number;
  exp?: number;
}

export type AuthPatient = Pick<PatientProfile, 'id' | 'firstName' | 'lastName' | 'email'>;

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly patientService = inject(PatientService);

  private readonly authenticated = signal(this.hasValidStoredToken());
  private readonly currentPatient = signal<AuthPatient | null>(null);

  readonly isAuthenticated = this.authenticated.asReadonly();
  readonly patient = this.currentPatient.asReadonly();
  readonly firstName = computed(() => this.currentPatient()?.firstName?.trim() ?? '');

  constructor() {
    if (this.authenticated()) {
      this.restorePatient();
    }
  }

  saveSession(token: string, patient?: AuthPatient | null): void {
    localStorage.setItem(TOKEN_KEY, token);
    this.authenticated.set(true);

    if (patient) {
      this.currentPatient.set(patient);
    }

    this.restorePatient();
  }

  saveToken(token: string): void {
    this.saveSession(token);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  isLoggedIn(): boolean {
    if (!this.hasValidStoredToken()) {
      if (this.authenticated()) {
        this.clearSession();
      }
      return false;
    }

    if (!this.authenticated()) {
      this.authenticated.set(true);
    }

    return true;
  }

  logout(): void {
    this.clearSession();
  }

  setPatient(patient: AuthPatient): void {
    this.currentPatient.set(patient);
  }

  private restorePatient(): void {
    if (!this.hasValidStoredToken()) {
      return;
    }

    this.patientService.getMe().subscribe({
      next: (patient) => {
        this.currentPatient.set(patient);
      },
      error: (error) => {
        if (error?.status === 401) {
          this.clearSession();
        }
      }
    });
  }

  private clearSession(): void {
    localStorage.removeItem(TOKEN_KEY);
    this.authenticated.set(false);
    this.currentPatient.set(null);
  }

  private hasValidStoredToken(): boolean {
    const token = this.getToken();

    if (!token) {
      return false;
    }

    const payload = this.readTokenPayload(token);

    if (!payload?.exp) {
      localStorage.removeItem(TOKEN_KEY);
      return false;
    }

    if (payload.exp * 1000 <= Date.now()) {
      localStorage.removeItem(TOKEN_KEY);
      return false;
    }

    return true;
  }

  private readTokenPayload(token: string): PatientTokenPayload | null {
    try {
      const parts = token.split('.');

      if (parts.length < 2) {
        return null;
      }

      const payload = parts[1]
        .replace(/-/g, '+')
        .replace(/_/g, '/');
      const padded = payload.padEnd(payload.length + (4 - (payload.length % 4)) % 4, '=');

      return JSON.parse(atob(padded)) as PatientTokenPayload;
    } catch {
      return null;
    }
  }
}
