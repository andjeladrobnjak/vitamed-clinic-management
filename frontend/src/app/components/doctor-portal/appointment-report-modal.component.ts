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
import { Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { ReportDraftService } from '../../services/report-draft.service';

function requiredTrimmed(message: string) {
  return (control: AbstractControl): ValidationErrors | null => {
    if (typeof control.value !== 'string' || !control.value.trim()) {
      return { requiredTrimmed: message };
    }
    return null;
  };
}

export interface ReportModalAppointment {
  patient: { firstName: string; lastName: string };
  service: { name: string };
  startTime: string;
  endTime: string;
}

export interface ReportModalValues {
  anamnesis: string;
  findings: string;
  diagnosis: string;
  therapyRecommendations: string | null;
}

@Component({
  selector: 'app-appointment-report-modal',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './appointment-report-modal.component.html',
  styleUrl: './appointment-report-modal.component.css'
})
export class AppointmentReportModalComponent implements AfterViewInit, OnDestroy {
  readonly appointment = input.required<ReportModalAppointment>();
  readonly appointmentDate = input.required<string>();
  readonly appointmentId = input(0);
  readonly canRestoreDraft = input(false);
  readonly isSaving = input(false);
  readonly errorMessage = input('');
  readonly mode = input<'complete' | 'edit'>('complete');
  readonly initialReport = input<ReportModalValues | null>(null);

  readonly dismissed = output<void>();
  readonly submitted = output<{
    anamnesis: string;
    findings: string;
    diagnosis: string;
    therapyRecommendations?: string;
  }>();

  readonly closeIcon = LucideX.icon.node;
  submittedAttempt = false;
  discardConfirmOpen = false;
  draftRestored = false;

  private readonly fb = inject(FormBuilder);
  private readonly drafts = inject(ReportDraftService);
  private readonly dialog = viewChild<ElementRef<HTMLElement>>('dialog');
  private readonly closeButton = viewChild<ElementRef<HTMLButtonElement>>('closeButton');
  private previousOverflow = '';
  private previousFocus: HTMLElement | null = null;
  private draftSub: Subscription | null = null;
  private originalValues: ReportModalValues = {
    anamnesis: '',
    findings: '',
    diagnosis: '',
    therapyRecommendations: null
  };

  readonly reportForm = this.fb.group({
    anamnesis: ['', [Validators.required, requiredTrimmed('Unesite anamnezu i tegobe.')]],
    findings: ['', [Validators.required, requiredTrimmed('Unesite nalaz.')]],
    diagnosis: ['', [Validators.required, requiredTrimmed('Unesite dijagnozu.')]],
    therapyRecommendations: ['']
  });

  constructor() {
    effect(() => {
      const initial = this.initialReport();
      if (this.mode() === 'edit' && initial) {
        this.originalValues = {
          anamnesis: initial.anamnesis,
          findings: initial.findings,
          diagnosis: initial.diagnosis,
          therapyRecommendations: initial.therapyRecommendations
        };
        this.reportForm.reset(
          {
            anamnesis: initial.anamnesis,
            findings: initial.findings,
            diagnosis: initial.diagnosis,
            therapyRecommendations: initial.therapyRecommendations ?? ''
          },
          { emitEvent: false }
        );
      }
    });

    effect(() => {
      if (this.isSaving()) {
        this.reportForm.disable({ emitEvent: false });
      } else {
        this.reportForm.enable({ emitEvent: false });
      }
    });
  }

  get isEditMode(): boolean {
    return this.mode() === 'edit';
  }

  get title(): string {
    return this.isEditMode ? 'Izmeni izveštaj' : 'Izveštaj sa pregleda';
  }

  get submitLabel(): string {
    if (this.isSaving()) {
      return 'Čuvanje…';
    }
    return this.isEditMode ? 'Sačuvaj izmene' : 'Sačuvaj izveštaj i završi pregled';
  }

  get cancelLabel(): string {
    return this.isEditMode ? 'Odustani' : 'Otkaži';
  }

  get discardMessage(): string {
    return this.isEditMode
      ? 'Želite li da zatvorite izveštaj? Izmene neće biti sačuvane.'
      : 'Želite li da zatvorite izveštaj? Uneti podaci neće biti sačuvani.';
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
    this.restoreDraft();
    this.startDraftAutosave();
    this.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    this.closeButton()?.nativeElement.focus();
  }

  ngOnDestroy(): void {
    this.draftSub?.unsubscribe();
    this.draftSub = null;
    document.body.style.overflow = this.previousOverflow;
    this.previousFocus?.focus();
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (this.isSaving()) {
        return;
      }
      if (this.discardConfirmOpen) {
        this.keepEditing();
        return;
      }
      this.requestClose();
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
      this.requestClose();
    }
  }

  requestClose(): void {
    if (this.isSaving()) {
      return;
    }
    if (this.hasUnsavedInput()) {
      this.discardConfirmOpen = true;
      return;
    }
    this.dismissed.emit();
  }

  keepEditing(): void {
    this.discardConfirmOpen = false;
  }

  confirmDiscard(): void {
    if (this.isSaving()) {
      return;
    }
    this.drafts.clear(this.appointmentId());
    this.dismissed.emit();
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

  private restoreDraft(): void {
    if (this.mode() !== 'complete' || !this.canRestoreDraft()) {
      return;
    }
    const draft = this.drafts.load(this.appointmentId());
    if (!draft) {
      return;
    }
    this.reportForm.reset(
      {
        anamnesis: draft.anamnesis,
        findings: draft.findings,
        diagnosis: draft.diagnosis,
        therapyRecommendations: draft.therapyRecommendations
      },
      { emitEvent: false }
    );
    this.draftRestored = true;
  }

  private startDraftAutosave(): void {
    if (this.mode() !== 'complete') {
      return;
    }
    this.draftSub = this.reportForm.valueChanges.pipe(debounceTime(600)).subscribe(() => {
      const value = this.reportForm.getRawValue();
      this.drafts.save(this.appointmentId(), {
        anamnesis: value.anamnesis ?? '',
        findings: value.findings ?? '',
        diagnosis: value.diagnosis ?? '',
        therapyRecommendations: value.therapyRecommendations ?? ''
      });
    });
  }

  private hasUnsavedInput(): boolean {
    const value = this.reportForm.getRawValue();
    if (this.mode() === 'edit') {
      return (
        this.normalized(value.anamnesis) !== this.normalized(this.originalValues.anamnesis) ||
        this.normalized(value.findings) !== this.normalized(this.originalValues.findings) ||
        this.normalized(value.diagnosis) !== this.normalized(this.originalValues.diagnosis) ||
        this.normalized(value.therapyRecommendations) !==
          this.normalized(this.originalValues.therapyRecommendations)
      );
    }

    return [value.anamnesis, value.findings, value.diagnosis, value.therapyRecommendations]
      .some((field) => typeof field === 'string' && field.trim() !== '');
  }

  private normalized(value: string | null | undefined): string {
    return (value ?? '').trim();
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
