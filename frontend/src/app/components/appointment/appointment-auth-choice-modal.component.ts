import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, output, viewChild } from '@angular/core';

@Component({
  selector: 'app-appointment-auth-choice-modal',
  standalone: true,
  templateUrl: './appointment-auth-choice-modal.component.html',
  styleUrl: './appointment-auth-choice-modal.component.css'
})
export class AppointmentAuthChoiceModalComponent implements AfterViewInit, OnDestroy {
  readonly login = output<void>();
  readonly guest = output<void>();
  readonly register = output<void>();
  readonly closed = output<void>();

  private readonly dialog = viewChild<ElementRef<HTMLElement>>('dialog');
  private readonly loginButton = viewChild<ElementRef<HTMLButtonElement>>('loginButton');
  private previousOverflow = '';
  private previousFocus: HTMLElement | null = null;

  ngAfterViewInit(): void {
    this.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    this.loginButton()?.nativeElement.focus();
  }

  ngOnDestroy(): void {
    document.body.style.overflow = this.previousOverflow;
    this.previousFocus?.focus();
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closed.emit();
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
    if (event.target === event.currentTarget) {
      this.closed.emit();
    }
  }

  private focusableElements(): HTMLElement[] {
    const root = this.dialog()?.nativeElement;
    if (!root) {
      return [];
    }

    return Array.from(
      root.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]')
    );
  }
}
