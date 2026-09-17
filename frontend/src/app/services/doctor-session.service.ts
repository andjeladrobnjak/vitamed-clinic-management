import { Injectable, NgZone, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { DoctorAuthService } from './doctor-auth.service';
import { DOCTOR_SESSION } from './doctor-session.constants';

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'click', 'input'] as const;

@Injectable({
  providedIn: 'root'
})
export class DoctorSessionService {
  private readonly doctorAuth = inject(DoctorAuthService);
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);

  private lastActivityAt = 0;
  private checkTimer: ReturnType<typeof setInterval> | null = null;
  private listening = false;
  private readonly onActivity = () => {
    this.lastActivityAt = Date.now();
  };

  constructor() {
    effect(() => {
      if (this.doctorAuth.isAuthenticated()) {
        this.start();
      } else {
        this.stop();
      }
    });
  }

  private start(): void {
    this.lastActivityAt = Date.now();
    this.bindActivity();
    if (this.checkTimer !== null) {
      return;
    }
    this.zone.runOutsideAngular(() => {
      this.checkTimer = setInterval(() => this.tick(), DOCTOR_SESSION.checkIntervalMs);
    });
    this.tick();
  }

  private stop(): void {
    this.unbindActivity();
    if (this.checkTimer !== null) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }

  private tick(): void {
    if (!this.doctorAuth.isLoggedIn()) {
      this.zone.run(() => this.endSession());
      return;
    }

    const idleFor = Date.now() - this.lastActivityAt;
    if (idleFor >= DOCTOR_SESSION.idleTimeoutMs) {
      this.zone.run(() => this.endSession());
      return;
    }

    if (this.doctorAuth.tokenRemainingMs() <= DOCTOR_SESSION.refreshWhenRemainingMs) {
      this.zone.run(() => {
        this.doctorAuth.refreshToken().subscribe({
          error: () => undefined
        });
      });
    }
  }

  private endSession(): void {
    this.doctorAuth.logout();
    if (!this.router.url.startsWith('/lekar/prijava')) {
      void this.router.navigate(['/lekar/prijava']);
    }
  }

  private bindActivity(): void {
    if (this.listening) {
      return;
    }
    this.listening = true;
    for (const eventName of ACTIVITY_EVENTS) {
      document.addEventListener(eventName, this.onActivity, { capture: true, passive: true });
    }
  }

  private unbindActivity(): void {
    if (!this.listening) {
      return;
    }
    this.listening = false;
    for (const eventName of ACTIVITY_EVENTS) {
      document.removeEventListener(eventName, this.onActivity, { capture: true });
    }
  }
}
