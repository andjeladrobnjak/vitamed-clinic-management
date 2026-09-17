import { Injectable } from '@angular/core';

export interface ReportDraftFields {
  anamnesis: string;
  findings: string;
  diagnosis: string;
  therapyRecommendations: string;
}

@Injectable({
  providedIn: 'root'
})
export class ReportDraftService {
  save(appointmentId: number, fields: ReportDraftFields): void {
    if (!this.isValidId(appointmentId)) {
      return;
    }
    sessionStorage.setItem(this.key(appointmentId), JSON.stringify(fields));
  }

  load(appointmentId: number): ReportDraftFields | null {
    if (!this.isValidId(appointmentId)) {
      return null;
    }
    const raw = sessionStorage.getItem(this.key(appointmentId));
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<ReportDraftFields>;
      if (
        typeof parsed.anamnesis !== 'string' ||
        typeof parsed.findings !== 'string' ||
        typeof parsed.diagnosis !== 'string'
      ) {
        return null;
      }
      return {
        anamnesis: parsed.anamnesis,
        findings: parsed.findings,
        diagnosis: parsed.diagnosis,
        therapyRecommendations: typeof parsed.therapyRecommendations === 'string'
          ? parsed.therapyRecommendations
          : ''
      };
    } catch {
      return null;
    }
  }

  clear(appointmentId: number): void {
    if (!this.isValidId(appointmentId)) {
      return;
    }
    sessionStorage.removeItem(this.key(appointmentId));
  }

  private key(appointmentId: number): string {
    return `vitamed_report_draft_${appointmentId}`;
  }

  private isValidId(appointmentId: number): boolean {
    return Number.isInteger(appointmentId) && appointmentId > 0;
  }
}
