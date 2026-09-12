import { Injectable } from '@angular/core';

const TOKEN_KEY = 'vitamed_patient_token';

interface PatientTokenPayload {
  patientId?: number;
  exp?: number;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  saveToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  isLoggedIn(): boolean {
    const token = this.getToken();

    if (!token) {
      return false;
    }

    const payload = this.readTokenPayload(token);

    if (!payload?.exp) {
      this.logout();
      return false;
    }

    if (payload.exp * 1000 <= Date.now()) {
      this.logout();
      return false;
    }

    return true;
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
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
