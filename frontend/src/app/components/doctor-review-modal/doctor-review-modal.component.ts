import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, OnInit, input, output, viewChild } from '@angular/core';
import { LucideStar, LucideX } from '@lucide/angular';
import { HistoryAppointment } from '../../services/appointment-availability.service';

@Component({
  selector: 'app-doctor-review-modal',
  standalone: true,
  templateUrl: './doctor-review-modal.component.html',
  styleUrl: './doctor-review-modal.component.css'
})
export class DoctorReviewModalComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly appointment = input.required<HistoryAppointment>();
  readonly isSaving = input(false);
  readonly errorMessage = input('');

  readonly dismissed = output<void>();
  readonly submitted = output<{ rating: number; comment: string | null }>();

  readonly starIcon = LucideStar.icon.node;
  readonly closeIcon = LucideX.icon.node;
  readonly stars = [1, 2, 3, 4, 5];

  selectedRating = 0;
  hoveredRating = 0;
  comment = '';

  private readonly dialog = viewChild<ElementRef<HTMLElement>>('dialog');
  private readonly closeButton = viewChild<ElementRef<HTMLButtonElement>>('closeButton');
  private previousOverflow = '';
  private previousFocus: HTMLElement | null = null;

  get isEditMode(): boolean {
    return this.appointment().review !== null;
  }

  get displayedRating(): number {
    return this.hoveredRating || this.selectedRating;
  }

  get commentLength(): number {
    return this.comment.length;
  }

  get canSubmit(): boolean {
    return this.selectedRating >= 1 && this.selectedRating <= 5 && !this.isSaving();
  }

  ngOnInit(): void {
    this.applyReviewFromAppointment();
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

  setHovered(rating: number): void {
    if (!this.isSaving()) {
      this.hoveredRating = rating;
    }
  }

  clearHovered(): void {
    this.hoveredRating = 0;
  }

  selectRating(rating: number): void {
    if (!this.isSaving()) {
      this.selectedRating = rating;
    }
  }

  onCommentInput(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.comment = value.slice(0, 500);
  }

  submit(): void {
    if (!this.canSubmit) {
      return;
    }

    const trimmed = this.comment.trim();
    this.submitted.emit({
      rating: this.selectedRating,
      comment: trimmed ? trimmed : null
    });
  }

  private applyReviewFromAppointment(): void {
    const existing = this.appointment().review;
    const rating = Number(existing?.rating);
    this.selectedRating = Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : 0;
    this.comment = existing?.comment ?? '';
    this.hoveredRating = 0;
  }

  private focusableElements(): HTMLElement[] {
    const root = this.dialog()?.nativeElement;
    if (!root) {
      return [];
    }

    return Array.from(
      root.querySelectorAll<HTMLElement>('button:not([disabled]), textarea:not([disabled])')
    );
  }
}
