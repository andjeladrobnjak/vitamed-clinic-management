import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, finalize, map, shareReplay, tap } from 'rxjs/operators';
import { DOCTOR_SESSION } from './doctor-session.constants';

const TOKEN_KEY = 'vitamed_doctor_token';
const doctorAuthUrl = 'http://localhost:3000/api/doctor-auth';

export interface AuthDoctorSpecialty {
  id: number;
  name: string;
}

export interface AuthDoctor {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  specialty: AuthDoctorSpecialty;
  mustChangePassword: boolean;
}

interface DoctorLoginResponse {
  message: string;
  token: string;
  doctor: AuthDoctor;
}

interface DoctorTokenPayload {
  role?: string;
  accountId?: number;
  doctorId?: number;
  exp?: number;
}

@Injectable({
  providedIn: 'root'
})
export class DoctorAuthService {
  private readonly http = inject(HttpClient);

  private readonly authenticated = signal(this.hasValidStoredToken());
  private readonly currentDoctor = signal<AuthDoctor | null>(null);
  private sessionGeneration = 0;
  private inFlightRestore$: Observable<boolean> | null = null;
  private inFlightRefresh$: Observable<{ token: string }> | null = null;

  readonly isAuthenticated = this.authenticated.asReadonly();
  readonly doctor = this.currentDoctor.asReadonly();
  readonly displayName = computed(() => {
    const doctor = this.currentDoctor();
    const firstName = doctor?.firstName?.trim() ?? '';
    const lastName = doctor?.lastName?.trim() ?? '';
    if (!firstName && !lastName) {
      return '';
    }
    return `dr ${firstName} ${lastName}`.trim();
  });

  login(email: string, password: string): Observable<DoctorLoginResponse> {
    return this.http.post<DoctorLoginResponse>(`${doctorAuthUrl}/login`, { email, password }).pipe(
      tap((response) => {
        this.saveSession(response.token, response.doctor);
      })
    );
  }

  changePassword(password: string, confirmPassword: string): Observable<DoctorLoginResponse> {
    return this.http
      .post<DoctorLoginResponse>(`${doctorAuthUrl}/change-password`, { password, confirmPassword })
      .pipe(
        tap((response) => {
          this.saveSession(response.token, response.doctor);
        })
      );
  }

  mustChangePassword(): boolean {
    return this.currentDoctor()?.mustChangePassword === true;
  }

  markMustChangePassword(): void {
    const doctor = this.currentDoctor();
    if (doctor && !doctor.mustChangePassword) {
      this.currentDoctor.set({ ...doctor, mustChangePassword: true });
    }
  }

  homePath(): string {
    return this.mustChangePassword() ? '/lekar/promena-lozinke' : '/lekar/portal';
  }

  saveSession(token: string, doctor?: AuthDoctor | null): void {
    this.beginNewSession();
    localStorage.setItem(TOKEN_KEY, token);
    this.authenticated.set(true);

    if (doctor?.firstName && doctor?.lastName) {
      this.currentDoctor.set(doctor);
    }
  }

  restoreSession(): Observable<boolean> {
    if (!this.hasValidStoredToken()) {
      this.clearSession();
      return of(false);
    }

    this.authenticated.set(true);
    if (this.currentDoctor()) {
      return of(true);
    }

    if (!this.inFlightRestore$) {
      const generation = this.sessionGeneration;
      this.inFlightRestore$ = this.http.get<AuthDoctor>(`${doctorAuthUrl}/me`).pipe(
        tap((doctor) => {
          if (generation !== this.sessionGeneration) {
            return;
          }
          this.currentDoctor.set(doctor);
          this.authenticated.set(true);
        }),
        map((doctor) => generation === this.sessionGeneration && !!doctor),
        catchError((error: HttpErrorResponse) => {
          if (generation !== this.sessionGeneration) {
            return of(false);
          }
          if (error.status === 401) {
            this.clearSession();
            return of(false);
          }
          return of(this.hasValidStoredToken());
        }),
        finalize(() => {
          if (generation === this.sessionGeneration) {
            this.inFlightRestore$ = null;
          }
        }),
        shareReplay({ bufferSize: 1, refCount: false })
      );
    }

    return this.inFlightRestore$;
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  tokenRemainingMs(): number {
    const payload = this.readTokenPayload(this.getToken() ?? '');
    if (!payload?.exp) {
      return 0;
    }
    return payload.exp * 1000 - Date.now();
  }

  replaceToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
    this.authenticated.set(true);
  }

  refreshToken(): Observable<{ token: string } | null> {
    if (!this.hasValidStoredToken()) {
      return of(null);
    }

    if (this.tokenRemainingMs() > DOCTOR_SESSION.refreshWhenRemainingMs) {
      return of(null);
    }

    if (!this.inFlightRefresh$) {
      this.inFlightRefresh$ = this.http.post<{ token: string }>(`${doctorAuthUrl}/refresh`, {}).pipe(
        tap((response) => {
          if (response.token) {
            this.replaceToken(response.token);
          }
        }),
        finalize(() => {
          this.inFlightRefresh$ = null;
        }),
        shareReplay({ bufferSize: 1, refCount: false })
      );
    }

    return this.inFlightRefresh$;
  }

  isLoggedIn(): boolean {
    if (!this.hasValidStoredToken()) {
      if (this.authenticated() || this.currentDoctor()) {
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

  private beginNewSession(): void {
    this.sessionGeneration += 1;
    this.inFlightRestore$ = null;
    this.inFlightRefresh$ = null;
  }

  private clearSession(): void {
    this.beginNewSession();
    localStorage.removeItem(TOKEN_KEY);
    this.authenticated.set(false);
    this.currentDoctor.set(null);
  }

  private hasValidStoredToken(): boolean {
    const token = this.getToken();
    if (!token) {
      return false;
    }

    const payload = this.readTokenPayload(token);
    if (!payload?.exp || payload.role !== 'doctor') {
      localStorage.removeItem(TOKEN_KEY);
      return false;
    }

    if (payload.exp * 1000 <= Date.now()) {
      localStorage.removeItem(TOKEN_KEY);
      return false;
    }

    return true;
  }

  private readTokenPayload(token: string): DoctorTokenPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length < 2) {
        return null;
      }

      const payload = parts[1]
        .replace(/-/g, '+')
        .replace(/_/g, '/');
      const padded = payload.padEnd(payload.length + (4 - (payload.length % 4)) % 4, '=');

      return JSON.parse(atob(padded)) as DoctorTokenPayload;
    } catch {
      return null;
    }
  }
}
