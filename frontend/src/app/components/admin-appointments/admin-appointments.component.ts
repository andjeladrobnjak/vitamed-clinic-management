import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { LucideCircleAlert, LucideCircleCheck, LucidePlus, LucideSearch, LucideTriangleAlert, LucideX } from '@lucide/angular';
import {
  AdminAppointment,
  AdminPortalService
} from '../../services/admin-portal.service';
import { Doctor, DoctorService } from '../../services/doctor.service';
import { VitamedSelectComponent, VitamedSelectOption } from '../vitamed-select/vitamed-select.component';

@Component({
  selector: 'app-admin-appointments',
  standalone: true,
  imports: [RouterLink, VitamedSelectComponent],
  templateUrl: './admin-appointments.component.html',
  styleUrls: [
    './admin-appointments.component.css',
    './admin-appointments-table.css',
    './admin-appointments-modal.css'
  ]
})
export class AdminAppointmentsComponent implements OnInit, OnDestroy {
  readonly searchIcon = LucideSearch.icon.node;
  readonly plusIcon = LucidePlus.icon.node;
  readonly closeIcon = LucideX.icon.node;
  readonly successIcon = LucideCircleCheck.icon.node;
  readonly alertIcon = LucideCircleAlert.icon.node;
  readonly warningIcon = LucideTriangleAlert.icon.node;

  readonly statusFilterOptions: VitamedSelectOption<string>[] = [
    { value: '', label: 'Svi statusi' },
    { value: 'confirmed', label: 'Zakazano' },
    { value: 'completed', label: 'Završeno' },
    { value: 'cancelled', label: 'Otkazano' },
    { value: 'no_show', label: 'Nije se pojavio' }
  ];

  @ViewChild('closeDetailsButton') private closeDetailsButton?: ElementRef<HTMLButtonElement>;

  appointments: AdminAppointment[] = [];
  doctors: Doctor[] = [];
  searchQuery = '';
  selectedDate = '';
  selectedStatus = '';
  selectedDoctorId = '';
  isLoading = true;
  isRefreshing = false;
  loadError = '';
  page = 1;
  pageSize = 15;
  totalItems = 0;
  totalPages = 1;
  successMessage = '';
  detailsOpen = false;
  selected: AdminAppointment | null = null;
  confirmOpen = false;
  isCancelling = false;
  cancelError = '';

  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private successTimer: ReturnType<typeof setTimeout> | null = null;
  private requestSeq = 0;
  private previousFocus: HTMLElement | null = null;
  private previousOverflow = '';
  private scrollLocked = false;
  private readonly portalService = inject(AdminPortalService);
  private readonly doctorService = inject(DoctorService);

  ngOnInit(): void {
    this.doctorService.getDoctors().subscribe({
      next: (doctors) => {
        this.doctors = [...doctors].sort((a, b) =>
          `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'sr')
        );
      }
    });
    this.load();
  }

  ngOnDestroy(): void {
    this.clearSearchTimer();
    this.clearSuccessTimer();
    this.unlockPage();
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || this.isCancelling) {
      return;
    }
    if (this.confirmOpen) {
      event.preventDefault();
      this.closeConfirm();
      return;
    }
    if (this.detailsOpen) {
      event.preventDefault();
      this.closeDetails();
    }
  }

  onSearchInput(event: Event): void {
    this.searchQuery = (event.target as HTMLInputElement).value;
    this.page = 1;
    this.scheduleLoad();
  }

  onDateChange(event: Event): void {
    this.selectedDate = (event.target as HTMLInputElement).value;
    this.page = 1;
    this.load();
  }

  clearDate(): void {
    if (!this.selectedDate) {
      return;
    }
    this.selectedDate = '';
    this.page = 1;
    this.load();
  }

  onStatusChange(value: string | number | boolean | null): void {
    this.selectedStatus = value == null ? '' : String(value);
    this.page = 1;
    this.load();
  }

  onDoctorChange(value: string | number | boolean | null): void {
    this.selectedDoctorId = value == null ? '' : String(value);
    this.page = 1;
    this.load();
  }

  retryLoad(): void {
    this.load();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.page) {
      return;
    }
    this.page = page;
    this.load();
  }

  get rangeStart(): number {
    if (this.totalItems === 0) {
      return 0;
    }
    return (this.page - 1) * this.pageSize + 1;
  }

  get rangeEnd(): number {
    return Math.min(this.page * this.pageSize, this.totalItems);
  }

  get showPagination(): boolean {
    return this.totalItems > this.pageSize;
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, index) => index + 1);
  }

  rangeLabel(): string {
    return `Prikazano ${this.rangeStart}-${this.rangeEnd} od ${this.totalItems} ${this.terminWord(this.totalItems)}`;
  }

  emptyMessage(): string {
    if (!this.searchQuery.trim() && !this.selectedDate && !this.selectedStatus && !this.selectedDoctorId) {
      return 'Trenutno nema zakazanih termina.';
    }
    return 'Nema termina koji odgovaraju izabranim kriterijumima.';
  }

  formatDate(isoDate: string): string {
    const [year, month, day] = isoDate.split('-');
    if (!year || !month || !day) {
      return isoDate;
    }
    return `${day}.${month}.${year}.`;
  }

  patientName(appointment: AdminAppointment): string {
    return `${appointment.patientFirstName} ${appointment.patientLastName}`.trim();
  }

  doctorName(appointment: AdminAppointment): string {
    return `dr ${appointment.doctor.firstName} ${appointment.doctor.lastName}`.trim();
  }

  doctorOptionLabel(doctor: Doctor): string {
    return `dr ${doctor.firstName} ${doctor.lastName}`.trim();
  }

  get doctorFilterOptions(): VitamedSelectOption<string>[] {
    return [
      { value: '', label: 'Svi lekari' },
      ...this.doctors.map((doctor) => ({ value: String(doctor.id), label: this.doctorOptionLabel(doctor) }))
    ];
  }

  statusLabel(status: string): string {
    if (status === 'completed') {
      return 'Završeno';
    }
    if (status === 'cancelled') {
      return 'Otkazano';
    }
    if (status === 'no_show') {
      return 'Nije se pojavio';
    }
    return 'Zakazano';
  }

  statusClass(status: string): string {
    if (status === 'completed') {
      return 'is-completed';
    }
    if (status === 'cancelled') {
      return 'is-cancelled';
    }
    if (status === 'no_show') {
      return 'is-no-show';
    }
    return 'is-confirmed';
  }

  openDetails(appointment: AdminAppointment): void {
    this.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.selected = appointment;
    this.detailsOpen = true;
    this.lockPage();
    setTimeout(() => this.closeDetailsButton?.nativeElement.focus());
  }

  closeDetails(): void {
    if (this.confirmOpen || this.isCancelling) {
      return;
    }
    this.detailsOpen = false;
    this.selected = null;
    this.unlockPage();
    this.previousFocus?.focus();
    this.previousFocus = null;
  }

  openCancel(appointment: AdminAppointment, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (!appointment.cancellable || this.isCancelling) {
      return;
    }
    if (!this.detailsOpen) {
      this.previousFocus = event?.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    }
    this.selected = appointment;
    this.cancelError = '';
    this.confirmOpen = true;
    this.lockPage();
  }

  closeConfirm(): void {
    if (this.isCancelling) {
      return;
    }
    this.confirmOpen = false;
    this.cancelError = '';
    if (!this.detailsOpen) {
      this.unlockPage();
      this.previousFocus?.focus();
      this.previousFocus = null;
      this.selected = null;
    }
  }

  confirmMessage(): string {
    if (!this.selected) {
      return '';
    }
    return `Da li ste sigurni da želite da otkažete pregled pacijenta ${this.patientName(this.selected)} zakazan za ${this.formatDate(this.selected.appointmentDate)} u ${this.selected.startTime}?`;
  }

  confirmCancel(): void {
    if (!this.selected || this.isCancelling || !this.selected.cancellable) {
      return;
    }

    this.isCancelling = true;
    this.cancelError = '';
    const appointmentId = this.selected.id;

    this.portalService.cancelAppointment(appointmentId).subscribe({
      next: () => {
        this.isCancelling = false;
        this.confirmOpen = false;
        this.detailsOpen = false;
        this.selected = null;
        this.unlockPage();
        this.previousFocus?.focus();
        this.previousFocus = null;
        this.showSuccess('Termin je uspešno otkazan.');
        this.load();
      },
      error: (error: HttpErrorResponse) => {
        this.isCancelling = false;
        this.cancelError = error.error?.message || 'Termin trenutno nije moguće otkazati.';
      }
    });
  }

  private load(): void {
    this.clearSearchTimer();
    this.loadError = '';
    if (this.appointments.length === 0) {
      this.isLoading = true;
    } else {
      this.isRefreshing = true;
    }

    const seq = ++this.requestSeq;
    this.portalService
      .getAppointments({
        search: this.searchQuery.trim(),
        date: this.selectedDate,
        status: this.selectedStatus,
        doctorId: this.selectedDoctorId ? Number(this.selectedDoctorId) : null,
        page: this.page,
        pageSize: this.pageSize
      })
      .subscribe({
        next: (result) => {
          if (seq !== this.requestSeq) {
            return;
          }
          this.appointments = result.items;
          this.page = result.page;
          this.pageSize = result.pageSize;
          this.totalItems = result.totalItems;
          this.totalPages = result.totalPages;
          this.isLoading = false;
          this.isRefreshing = false;
          if (this.selected) {
            this.selected = result.items.find((item) => item.id === this.selected?.id) ?? this.selected;
          }
        },
        error: () => {
          if (seq !== this.requestSeq) {
            return;
          }
          this.isLoading = false;
          this.isRefreshing = false;
          this.loadError = 'Došlo je do greške pri učitavanju termina.';
        }
      });
  }

  private scheduleLoad(): void {
    this.clearSearchTimer();
    this.searchTimer = setTimeout(() => this.load(), 300);
  }

  private lockPage(): void {
    if (this.scrollLocked) {
      return;
    }
    this.scrollLocked = true;
    this.previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }

  private unlockPage(): void {
    if (!this.scrollLocked) {
      return;
    }
    this.scrollLocked = false;
    document.body.style.overflow = this.previousOverflow;
    this.previousOverflow = '';
  }

  private showSuccess(message: string): void {
    this.successMessage = message;
    this.clearSuccessTimer();
    this.successTimer = setTimeout(() => {
      this.successMessage = '';
      this.successTimer = null;
    }, 4000);
  }

  private clearSearchTimer(): void {
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
  }

  private clearSuccessTimer(): void {
    if (this.successTimer !== null) {
      clearTimeout(this.successTimer);
      this.successTimer = null;
    }
  }

  private terminWord(count: number): string {
    const n = Math.abs(count) % 100;
    const last = n % 10;
    if (n >= 11 && n <= 14) {
      return 'termina';
    }
    if (last === 1) {
      return 'termin';
    }
    return 'termina';
  }
}
