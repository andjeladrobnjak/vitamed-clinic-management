import { Injectable } from '@angular/core';

const STORAGE_KEY = 'vitamed_booking_draft';

export interface BookingDraft {
  serviceId: number | null;
  locationId: number | null;
  doctorId: number | null;
  entryDoctorId: number | null;
  appointmentDate: string;
  appointmentTime: string | null;
  timeAcknowledged: boolean;
  resumeAfterAuth: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class BookingDraftService {
  save(draft: BookingDraft): void {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }

  read(): BookingDraft | null {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as BookingDraft;
      if (!parsed || typeof parsed !== 'object') {
        return null;
      }
      return parsed;
    } catch {
      this.clear();
      return null;
    }
  }

  consumeResumeDraft(): BookingDraft | null {
    const draft = this.read();
    if (!draft?.resumeAfterAuth) {
      return null;
    }

    this.save({ ...draft, resumeAfterAuth: false });
    return draft;
  }

  clear(): void {
    sessionStorage.removeItem(STORAGE_KEY);
  }
}
