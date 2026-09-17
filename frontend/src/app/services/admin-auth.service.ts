import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, finalize, map, shareReplay, tap } from 'rxjs/operators';

const TOKEN_KEY = 'vitamed_admin_token';
const adminAuthUrl = 'http://localhost:3000/api/admin-auth';

export interface AuthAdmin {
  id: number;
  email: string;
  role: 'admin';
}

interface AdminLoginResponse {
  message: string;
  token: string;
  admin: AuthAdmin;
}

interface AdminTokenPayload {
  role?: string;
  adminId?: number;
  exp?: number;
}

@Injectable({
  providedIn: 'root'
})
export class AdminAuthService {
  private readonly http = inject(HttpClient);

  private readonly authenticated = signal(this.hasValidStoredToken());
  private readonly currentAdmin = signal<AuthAdmin | null>(null);
  private sessionGeneration = 0;
  private inFlightRestore$: Observable<boolean> | null = null;

  readonly isAuthenticated = this.authenticated.asReadonly();
  readonly admin = this.currentAdmin.asReadonly();

  login(email: string, password: string): Observable<AdminLoginResponse> {
    return this.http.post<AdminLoginResponse>(`${adminAuthUrl}/login`, { email, password }).pipe(
      tap((response) => {
        this.saveSession(response.token, response.admin);
      })
    );
  }

  saveSession(token: string, admin?: AuthAdmin | null): void {
    this.beginNewSession();
    localStorage.setItem(TOKEN_KEY, token);
    this.authenticated.set(true);
    if (admin?.email) {
      this.currentAdmin.set({
        id: admin.id,
        email: admin.email,
        role: 'admin'
      });
    }
  }

  restoreSession(): Observable<boolean> {
    if (!this.hasValidStoredToken()) {
      this.clearSession();
      return of(false);
    }

    this.authenticated.set(true);
    if (this.currentAdmin()) {
      return of(true);
    }

    if (!this.inFlightRestore$) {
      const generation = this.sessionGeneration;
      this.inFlightRestore$ = this.http.get<AuthAdmin>(`${adminAuthUrl}/me`).pipe(
        tap((admin) => {
          if (generation !== this.sessionGeneration) {
            return;
          }
          this.currentAdmin.set(admin);
          this.authenticated.set(true);
        }),
        map((admin) => generation === this.sessionGeneration && !!admin),
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

  isLoggedIn(): boolean {
    if (!this.hasValidStoredToken()) {
      if (this.authenticated() || this.currentAdmin()) {
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
  }

  private clearSession(): void {
    this.beginNewSession();
    localStorage.removeItem(TOKEN_KEY);
    this.authenticated.set(false);
    this.currentAdmin.set(null);
  }

  private hasValidStoredToken(): boolean {
    const token = this.getToken();
    if (!token) {
      return false;
    }

    const payload = this.readTokenPayload(token);
    if (!payload?.exp || payload.role !== 'admin') {
      localStorage.removeItem(TOKEN_KEY);
      return false;
    }

    if (payload.exp * 1000 <= Date.now()) {
      localStorage.removeItem(TOKEN_KEY);
      return false;
    }

    return true;
  }

  private readTokenPayload(token: string): AdminTokenPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length < 2) {
        return null;
      }

      const payload = parts[1]
        .replace(/-/g, '+')
        .replace(/_/g, '/');
      const padded = payload.padEnd(payload.length + (4 - (payload.length % 4)) % 4, '=');

      return JSON.parse(atob(padded)) as AdminTokenPayload;
    } catch {
      return null;
    }
  }
}
