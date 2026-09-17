import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, input, output, viewChild } from '@angular/core';

export interface DoctorCancelAppointmentSummary {
  patientName: string;
  dateLabel: string;
  startTime: string;
}

@Component({
  selector: 'app-doctor-cancel-appointment-modal',
  standalone: true,
  templateUrl: './doctor-cancel-appointment-modal.component.html',
  styleUrl: './doctor-cancel-appointment-modal.component.css'
})
export class DoctorCancelAppointmentModalComponent implements AfterViewInit, OnDestroy {
  readonly summary = input.required<DoctorCancelAppointmentSummary>();
  readonly isCancelling = input(false);
  readonly errorMessage = input('');

  readonly dismissed = output<void>();
  readonly confirmed = output<void>();

  private readonly dialog = viewChild<ElementRef<HTMLElement>>('dialog');
  private readonly cancelButton = viewChild<ElementRef<HTMLButtonElement>>('cancelButton');
  private previousOverflow = '';
  private previousFocus: HTMLElement | null = null;

  ngAfterViewInit(): void {
    this.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    this.cancelButton()?.nativeElement.focus();
  }

  ngOnDestroy(): void {
    document.body.style.overflow = this.previousOverflow;
    this.previousFocus?.focus();
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (!this.isCancelling()) {
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
    if (this.isCancelling()) {
      return;
    }
    if (event.target === event.currentTarget) {
      this.dismissed.emit();
    }
  }

  private focusableElements(): HTMLElement[] {
    const root = this.dialog()?.nativeElement;
    if (!root) {
      return [];
    }
    return Array.from(root.querySelectorAll<HTMLElement>('button:not([disabled])'));
  }
}
