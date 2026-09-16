import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  effect,
  inject,
  input,
  output,
  viewChild
} from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { LucideX } from '@lucide/angular';
import { DoctorDashboardAppointment } from '../../services/doctor-portal.service';

function requiredTrimmed(message: string) {
  return (control: AbstractControl): ValidationErrors | null => {
    if (typeof control.value !== 'string' || !control.value.trim()) {
      return { requiredTrimmed: message };
    }
    return null;
  };
}

@Component({
  selector: 'app-appointment-report-modal',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './appointment-report-modal.component.html',
  styleUrl: './appointment-report-modal.component.css'
})
export class AppointmentReportModalComponent implements AfterViewInit, OnDestroy {
  readonly appointment = input.required<DoctorDashboardAppointment>();
  readonly appointmentDate = input.required<string>();
  readonly isSaving = input(false);
  readonly errorMessage = input('');

  readonly dismissed = output<void>();
  readonly submitted = output<{
    anamnesis: string;
    findings: string;
    diagnosis: string;
    therapyRecommendations?: string;
  }>();

  readonly closeIcon = LucideX.icon.node;
  submittedAttempt = false;

  private readonly fb = inject(FormBuilder);
  private readonly dialog = viewChild<ElementRef<HTMLElement>>('dialog');
  private readonly closeButton = viewChild<ElementRef<HTMLButtonElement>>('closeButton');
  private previousOverflow = '';
  private previousFocus: HTMLElement | null = null;

  readonly reportForm = this.fb.group({
    anamnesis: ['', [Validators.required, requiredTrimmed('Unesite anamnezu i tegobe.')]],
    findings: ['', [Validators.required, requiredTrimmed('Unesite nalaz.')]],
    diagnosis: ['', [Validators.required, requiredTrimmed('Unesite dijagnozu.')]],
    therapyRecommendations: ['']
  });

  constructor() {
    effect(() => {
      if (this.isSaving()) {
        this.reportForm.disable({ emitEvent: false });
      } else {
        this.reportForm.enable({ emitEvent: false });
      }
    });
  }

  get patientLine(): string {
    const appointment = this.appointment();
    const name = `${appointment.patient.firstName} ${appointment.patient.lastName}`.trim();
    return `${name} · ${appointment.service.name}`;
  }

  get scheduleLine(): string {
    const appointment = this.appointment();
    return `${this.formatDate(this.appointmentDate())} · ${appointment.startTime}–${appointment.endTime}`;
  }

  fieldError(name: 'anamnesis' | 'findings' | 'diagnosis'): string {
    const control = this.reportForm.controls[name];
    if (!control || !(control.touched || this.submittedAttempt)) {
      return '';
    }
    if (control.hasError('requiredTrimmed')) {
      return String(control.getError('requiredTrimmed'));
    }
    if (control.hasError('required')) {
      if (name === 'anamnesis') {
        return 'Unesite anamnezu i tegobe.';
      }
      if (name === 'findings') {
        return 'Unesite nalaz.';
      }
      return 'Unesite dijagnozu.';
    }
    return '';
  }

  ngAfterViewInit(): void {
    this.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    this.closeButton()?.nativeElement.focus();
  }

  ngOnDestroy(): void {
    document.body.style.overflow = this.previousOverflow;
    this.previousFocus?.focus();
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (!this.isSaving()) {
        this.dismissed.emit();
      }
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const focusable = this.focusableElements();
    if (focusable.length === 0) {
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  onOverlayClick(event: MouseEvent): void {
    if (this.isSaving()) {
      return;
    }
    if (event.target === event.currentTarget) {
      this.dismissed.emit();
    }
  }

  submit(): void {
    this.submittedAttempt = true;
    this.reportForm.markAllAsTouched();
    if (this.reportForm.invalid || this.isSaving()) {
      return;
    }

    const value = this.reportForm.getRawValue();
    const therapy = value.therapyRecommendations?.trim() ?? '';
    this.submitted.emit({
      anamnesis: value.anamnesis?.trim() ?? '',
      findings: value.findings?.trim() ?? '',
      diagnosis: value.diagnosis?.trim() ?? '',
      ...(therapy ? { therapyRecommendations: therapy } : {})
    });
  }

  private formatDate(isoDate: string): string {
    const date = new Date(`${isoDate}T12:00:00`);
    const formatted = new Intl.DateTimeFormat('sr-Latn-RS', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(date);
    return formatted.endsWith('.') ? formatted : `${formatted}.`;
  }

  private focusableElements(): HTMLElement[] {
    const root = this.dialog()?.nativeElement;
    if (!root) {
      return [];
    }

    return Array.from(
      root.querySelectorAll<HTMLElement>(
        'button:not([disabled]), textarea:not([disabled])'
      )
    );
  }
}
