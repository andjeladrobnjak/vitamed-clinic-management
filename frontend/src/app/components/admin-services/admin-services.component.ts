import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { LucideCircleAlert, LucideCircleCheck, LucidePencil, LucidePlus, LucideSearch } from '@lucide/angular';
import { AdminClinicServicePayload, AdminPortalService } from '../../services/admin-portal.service';
import { ClinicService, ClinicServiceApi } from '../../services/clinic-service.service';
import { DoctorService, Specialty } from '../../services/doctor.service';
import { VitamedSelectComponent, VitamedSelectOption } from '../vitamed-select/vitamed-select.component';

@Component({
  selector: 'app-admin-services',
  standalone: true,
  imports: [FormsModule, VitamedSelectComponent],
  templateUrl: './admin-services.component.html',
  styleUrls: [
    './admin-services.component.css',
    './admin-services-modal.css'
  ]
})
export class AdminServicesComponent implements OnInit, OnDestroy {
  readonly searchIcon = LucideSearch.icon.node;
  readonly plusIcon = LucidePlus.icon.node;
  readonly pencilIcon = LucidePencil.icon.node;
  readonly successIcon = LucideCircleCheck.icon.node;
  readonly alertIcon = LucideCircleAlert.icon.node;

  @ViewChild('nameInput') private nameInput?: ElementRef<HTMLInputElement>;
  @ViewChild('addButton') private addButton?: ElementRef<HTMLButtonElement>;

  services: ClinicService[] = [];
  specialties: Specialty[] = [];
  searchQuery = '';
  selectedSpecialtyId = '';
  isLoading = true;
  loadError = '';
  page = 1;
  successMessage = '';
  modalOpen = false;
  modalMode: 'create' | 'edit' = 'create';
  isSaving = false;
  modalError = '';
  nameError = '';
  specialtyError = '';
  priceError = '';
  durationError = '';
  discardOpen = false;
  editingId: number | null = null;
  formName = '';
  formSpecialtyId = 0;
  formSpecialtyName = '';
  formPrice: number | null = null;
  formDuration: number | null = null;
  formDescription = '';

  private snapshot = '';
  private previousFocus: HTMLElement | null = null;
  private previousOverflow = '';
  private successTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly pageSize = 10;
  private readonly clinicServiceApi = inject(ClinicServiceApi);
  private readonly doctorService = inject(DoctorService);
  private readonly portalService = inject(AdminPortalService);

  ngOnInit(): void {
    this.doctorService.getSpecialties().subscribe({
      next: (specialties) => {
        this.specialties = specialties;
      }
    });
    this.loadServices();
  }

  ngOnDestroy(): void {
    this.clearSuccessTimer();
    this.unlockPage();
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || this.isSaving) {
      return;
    }
    if (this.discardOpen) {
      event.preventDefault();
      this.discardOpen = false;
      return;
    }
    if (this.modalOpen) {
      event.preventDefault();
      this.requestClose();
    }
  }

  onSearchInput(event: Event): void {
    this.searchQuery = (event.target as HTMLInputElement).value;
    this.page = 1;
  }

  get specialtyFilterOptions(): VitamedSelectOption<string>[] {
    return [
      { value: '', label: 'Sve specijalizacije' },
      ...this.specialties.map((specialty) => ({ value: String(specialty.id), label: specialty.name }))
    ];
  }

  get specialtyFormOptions(): VitamedSelectOption<number>[] {
    return [
      { value: 0, label: 'Izaberite specijalizaciju' },
      ...this.specialties.map((specialty) => ({ value: specialty.id, label: specialty.name }))
    ];
  }

  onSpecialtyChange(value: string | number | boolean | null): void {
    this.selectedSpecialtyId = value == null ? '' : String(value);
    this.page = 1;
  }

  formatPrice(price: number): string {
    return `${new Intl.NumberFormat('sr-RS', { maximumFractionDigits: 0 }).format(price)} RSD`;
  }

  formatDuration(minutes: number): string {
    return `${minutes} min`;
  }

  serviceCountLabel(count: number): string {
    return `${count} ${this.uslugaWord(count)}`;
  }

  rangeLabel(): string {
    return `Prikazano ${this.rangeStart}-${this.rangeEnd} od ${this.filteredTotal} ${this.uslugaWord(this.filteredTotal)}`;
  }

  emptyMessage(): string {
    if (this.services.length === 0 && !this.searchQuery.trim() && !this.selectedSpecialtyId) {
      return 'Trenutno nema dostupnih usluga.';
    }
    return 'Nema usluga koje odgovaraju izabranoj pretrazi.';
  }

  get filteredServices(): ClinicService[] {
    const query = this.searchQuery.trim().toLowerCase();
    const specialtyId = this.selectedSpecialtyId ? Number(this.selectedSpecialtyId) : null;

    return this.services.filter((service) => {
      if (specialtyId !== null && service.specialty.id !== specialtyId) {
        return false;
      }
      if (!query) {
        return true;
      }
      return service.name.toLowerCase().includes(query);
    });
  }

  get filteredTotal(): number {
    return this.filteredServices.length;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredTotal / this.pageSize));
  }

  get pagedServices(): ClinicService[] {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredServices.slice(start, start + this.pageSize);
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, index) => index + 1);
  }

  get showPagination(): boolean {
    return this.filteredTotal > this.pageSize;
  }

  get rangeStart(): number {
    if (this.filteredTotal === 0) {
      return 0;
    }
    return (this.page - 1) * this.pageSize + 1;
  }

  get rangeEnd(): number {
    return Math.min(this.page * this.pageSize, this.filteredTotal);
  }

  get isCreate(): boolean {
    return this.modalMode === 'create';
  }

  get canSaveEdit(): boolean {
    return this.isDirty() && !this.isSaving;
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) {
      return;
    }
    this.page = page;
  }

  openCreate(): void {
    this.resetFormErrors();
    this.modalMode = 'create';
    this.editingId = null;
    this.formName = '';
    this.formSpecialtyId = 0;
    this.formSpecialtyName = '';
    this.formPrice = null;
    this.formDuration = null;
    this.formDescription = '';
    this.snapshot = this.serializeForm();
    this.openModal();
  }

  openEdit(service: ClinicService, event: Event): void {
    this.previousFocus = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    this.resetFormErrors();
    this.modalMode = 'edit';
    this.editingId = service.id;
    this.formName = service.name;
    this.formSpecialtyId = service.specialty.id;
    this.formSpecialtyName = service.specialty.name;
    this.formPrice = service.price;
    this.formDuration = service.durationMinutes;
    this.formDescription = service.description ?? '';
    this.snapshot = this.serializeForm();
    this.openModal();
  }

  requestClose(): void {
    if (this.isSaving) {
      return;
    }
    if (this.isDirty()) {
      this.discardOpen = true;
      return;
    }
    this.closeModal();
  }

  keepEditing(): void {
    this.discardOpen = false;
  }

  confirmDiscard(): void {
    this.discardOpen = false;
    this.closeModal();
  }

  submit(): void {
    if (this.isSaving) {
      return;
    }

    this.resetFormErrors();
    const name = this.formName.trim();
    this.nameError = name ? '' : 'Unesite naziv usluge.';
    if (this.isCreate && !this.formSpecialtyId) {
      this.specialtyError = 'Izaberite specijalizaciju.';
    }
    const price = Number(this.formPrice);
    this.priceError = Number.isFinite(price) && price > 0 ? '' : 'Unesite ispravnu cenu.';
    const duration = Number(this.formDuration);
    this.durationError =
      Number.isInteger(duration) && duration > 0 ? '' : 'Trajanje mora biti pozitivan broj minuta.';

    if (this.nameError || this.specialtyError || this.priceError || this.durationError) {
      this.modalError = 'Proverite obavezna polja.';
      return;
    }

    if (!this.isCreate && !this.isDirty()) {
      return;
    }

    const payload: AdminClinicServicePayload = {
      name,
      price,
      durationMinutes: duration,
      description: this.formDescription.trim() || null
    };
    if (this.isCreate) {
      payload.specialtyId = this.formSpecialtyId;
    }

    this.isSaving = true;
    const request$ =
      this.isCreate || !this.editingId
        ? this.portalService.createService(payload)
        : this.portalService.updateService(this.editingId, payload);

    request$.subscribe({
      next: () => {
        const success = this.isCreate ? 'Usluga je uspešno dodata.' : 'Usluga je uspešno izmenjena.';
        const resetPage = this.isCreate;
        this.isSaving = false;
        this.snapshot = this.serializeForm();
        this.closeModal();
        this.loadServices(success, resetPage);
      },
      error: (error: HttpErrorResponse) => {
        this.isSaving = false;
        this.modalError =
          error.error?.message ||
          (this.isCreate ? 'Trenutno nije moguće dodati uslugu.' : 'Trenutno nije moguće sačuvati uslugu.');
      }
    });
  }

  primaryActionLabel(): string {
    if (this.isCreate) {
      return this.isSaving ? 'Dodavanje...' : 'Dodaj uslugu';
    }
    return this.isSaving ? 'Čuvanje...' : 'Sačuvaj izmene';
  }

  private loadServices(success?: string, resetPage = false): void {
    this.isLoading = this.services.length === 0;
    this.loadError = '';
    this.clinicServiceApi.getServices().subscribe({
      next: (services) => {
        this.services = services;
        this.isLoading = false;
        if (resetPage) {
          this.page = 1;
        } else if (this.page > this.totalPages) {
          this.page = this.totalPages;
        }
        if (success) {
          this.showSuccess(success);
        }
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading = false;
        this.loadError = error.error?.message || 'Trenutno nije moguće učitati usluge.';
      }
    });
  }

  private openModal(): void {
    this.modalOpen = true;
    this.modalError = '';
    this.discardOpen = false;
    if (!this.previousFocus) {
      this.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    this.previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setTimeout(() => this.nameInput?.nativeElement.focus());
  }

  private closeModal(): void {
    this.modalOpen = false;
    this.discardOpen = false;
    this.resetFormErrors();
    this.unlockPage();
    const target = this.previousFocus ?? this.addButton?.nativeElement;
    this.previousFocus = null;
    target?.focus();
  }

  private unlockPage(): void {
    document.body.style.overflow = this.previousOverflow;
  }

  private isDirty(): boolean {
    return this.serializeForm() !== this.snapshot;
  }

  private serializeForm(): string {
    return JSON.stringify({
      name: this.formName.trim(),
      specialtyId: this.formSpecialtyId,
      price: this.formPrice,
      duration: this.formDuration,
      description: this.formDescription.trim()
    });
  }

  private resetFormErrors(): void {
    this.modalError = '';
    this.nameError = '';
    this.specialtyError = '';
    this.priceError = '';
    this.durationError = '';
  }

  private showSuccess(message: string): void {
    this.successMessage = message;
    this.clearSuccessTimer();
    this.successTimer = setTimeout(() => {
      this.successMessage = '';
      this.successTimer = null;
    }, 4000);
  }

  private clearSuccessTimer(): void {
    if (this.successTimer !== null) {
      clearTimeout(this.successTimer);
      this.successTimer = null;
    }
  }

  private uslugaWord(count: number): string {
    const n = Math.abs(count) % 100;
    const last = n % 10;
    if (n >= 11 && n <= 14) {
      return 'usluga';
    }
    if (last === 1) {
      return 'usluga';
    }
    if (last >= 2 && last <= 4) {
      return 'usluge';
    }
    return 'usluga';
  }
}
