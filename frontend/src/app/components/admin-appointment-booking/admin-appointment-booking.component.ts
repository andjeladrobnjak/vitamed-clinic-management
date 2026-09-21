import { Component, OnDestroy, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin, Subscription } from 'rxjs';
import { LucideCircleAlert, LucideCircleCheck, LucideSearch } from '@lucide/angular';
import { ClinicService, ClinicServiceApi } from '../../services/clinic-service.service';
import { DoctorService, Specialty } from '../../services/doctor.service';
import { ClinicLocation, LocationService } from '../../services/location.service';
import {
  AdminPortalService,
  AdminPatientLookup
} from '../../services/admin-portal.service';
import {
  AppointmentAvailabilityApi,
  CreatedAppointmentResponse
} from '../../services/appointment-availability.service';
import { formatSerbianDate } from '../../utils/format-serbian-date';
import { resolveMediaUrl } from '../../utils/media-url';
import {
  BOOKING_HORIZON_DAYS,
  BookingDoctor,
  WEEKDAY_LABELS,
  addDaysIso,
  collectSpecialties,
  formatDuration,
  formatNationalNumber,
  formatPrice,
  sortClinicServices,
  toBookingDoctor,
  toDateInputValue,
  toFormPhone
} from '../../utils/booking-catalog';

const BOOKING_STEPS = [
  { id: 1, label: 'Usluga' },
  { id: 2, label: 'Lokacija' },
  { id: 3, label: 'Lekar' },
  { id: 4, label: 'Datum' },
  { id: 5, label: 'Termin' },
  { id: 6, label: 'Pacijent' },
  { id: 7, label: 'Potvrda' }
] as const;

type LookupStatus = 'idle' | 'found' | 'not_found';

@Component({
  selector: 'app-admin-appointment-booking',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './admin-appointment-booking.component.html',
  styleUrl: './admin-appointment-booking.component.css'
})
export class AdminAppointmentBookingComponent implements OnDestroy {
  readonly steps = BOOKING_STEPS;
  readonly searchIcon = LucideSearch.icon.node;
  readonly successIcon = LucideCircleCheck.icon.node;
  readonly alertIcon = LucideCircleAlert.icon.node;
  readonly weekdayLabels = WEEKDAY_LABELS;
  readonly mediaUrl = resolveMediaUrl;
  readonly formatPrice = formatPrice;
  readonly formatDuration = formatDuration;
  readonly formatDisplayDate = formatSerbianDate;

  services: ClinicService[] = [];
  locations: ClinicLocation[] = [];
  doctors: BookingDoctor[] = [];
  specialties: Specialty[] = [];

  selectedService: ClinicService | null = null;
  selectedLocation: ClinicLocation | null = null;
  selectedDoctor: BookingDoctor | null = null;
  selectedDate = '';
  selectedTime: string | null = null;
  selectedSpecialtyId: number | null = null;
  serviceSearchQuery = '';
  activeStep = 1;

  isLoading = true;
  loadError = '';
  doctorRelationshipsReady = false;
  calendarYear = new Date().getFullYear();
  calendarMonth = new Date().getMonth();
  availableDates = new Set<string>();
  availableTimes: string[] = [];
  datesLoading = false;
  timesLoading = false;
  datesError = '';
  timesError = '';
  datesHorizonTo = '';
  isSubmitting = false;
  bookingResult: CreatedAppointmentResponse | null = null;
  slotConflictMessage = '';
  confirmError = '';

  lookupStatus: LookupStatus = 'idle';
  lookupError = '';
  isSearchingPatient = false;
  searchedJmbg = '';

  private advanceTimer: ReturnType<typeof setTimeout> | null = null;
  private datesRequest: Subscription | null = null;
  private timesRequest: Subscription | null = null;
  private readonly subscriptions = new Subscription();
  private readonly fb = inject(FormBuilder);
  private readonly clinicServiceApi = inject(ClinicServiceApi);
  private readonly locationService = inject(LocationService);
  private readonly doctorService = inject(DoctorService);
  private readonly availabilityApi = inject(AppointmentAvailabilityApi);
  private readonly portalService = inject(AdminPortalService);

  patientForm = this.fb.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    jmbg: ['', [Validators.required, Validators.pattern(/^\d{13}$/)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, Validators.pattern(/^\+381 \d{2} \d{3} \d{4}$/)]]
  });

  constructor() {
    this.loadBookingData();
  }

  ngOnDestroy(): void {
    this.clearAdvanceTimer();
    this.datesRequest?.unsubscribe();
    this.timesRequest?.unsubscribe();
    this.subscriptions.unsubscribe();
  }

  retryLoad(): void {
    this.loadError = '';
    this.isLoading = true;
    this.loadBookingData();
  }

  get identityLocked(): boolean {
    return this.lookupStatus === 'found' && this.isLookupCurrent;
  }

  get isLookupCurrent(): boolean {
    const jmbg = this.patientForm.controls.jmbg.value ?? '';
    return (this.lookupStatus === 'found' || this.lookupStatus === 'not_found') && this.searchedJmbg === jmbg;
  }

  get canContinueFromPatient(): boolean {
    return this.isLookupCurrent && this.patientForm.valid;
  }

  get patientKindLabel(): string {
    if (this.lookupStatus === 'found' && this.isLookupCurrent) {
      return 'Registrovan pacijent';
    }
    if (this.lookupStatus === 'not_found' && this.isLookupCurrent) {
      return 'Pacijent bez naloga';
    }
    return '';
  }

  get phoneNationalNumber(): string {
    return (this.patientForm.controls.phone.value ?? '').replace(/^\+381\s*/, '');
  }

  get displayedSpecialties(): Specialty[] {
    const ids = new Set(this.services.map((service) => service.specialty.id));
    return this.specialties.filter((specialty) => ids.has(specialty.id));
  }

  get isSearchingServices(): boolean {
    return this.serviceSearchQuery.trim() !== '';
  }

  get visibleServices(): ClinicService[] {
    const query = this.serviceSearchQuery.trim().toLowerCase();
    if (query) {
      return this.services.filter((service) => service.name.toLowerCase().includes(query));
    }
    if (this.selectedSpecialtyId === null) {
      return this.services;
    }
    return this.services.filter((service) => service.specialty.id === this.selectedSpecialtyId);
  }

  get eligibleDoctors(): BookingDoctor[] {
    if (!this.selectedService || !this.selectedLocation) {
      return [];
    }

    return this.doctors.filter(
      (doctor) =>
        doctor.serviceIds.map(Number).includes(Number(this.selectedService!.id)) &&
        doctor.locationIds.map(Number).includes(Number(this.selectedLocation!.id))
    );
  }

  get canSelectDate(): boolean {
    return Boolean(this.selectedService && this.selectedLocation && this.selectedDoctor);
  }

  get calendarTitle(): string {
    return new Date(this.calendarYear, this.calendarMonth, 1).toLocaleDateString('sr-RS', {
      month: 'long',
      year: 'numeric'
    });
  }

  get calendarWeeks(): Array<Array<{ date: string; day: number; inMonth: boolean }>> {
    const first = new Date(this.calendarYear, this.calendarMonth, 1);
    const mondayOffset = (first.getDay() + 6) % 7;
    const cursor = new Date(this.calendarYear, this.calendarMonth, 1 - mondayOffset);
    const weeks: Array<Array<{ date: string; day: number; inMonth: boolean }>> = [];

    for (let week = 0; week < 6; week += 1) {
      const days = [];
      for (let day = 0; day < 7; day += 1) {
        days.push({
          date: toDateInputValue(cursor),
          day: cursor.getDate(),
          inMonth: cursor.getMonth() === this.calendarMonth
        });
        cursor.setDate(cursor.getDate() + 1);
      }
      weeks.push(days);
    }

    return weeks;
  }

  get canGoToPreviousMonth(): boolean {
    const today = new Date();
    return (
      this.calendarYear > today.getFullYear() ||
      (this.calendarYear === today.getFullYear() && this.calendarMonth > today.getMonth())
    );
  }

  get canGoToNextMonth(): boolean {
    const horizon = this.datesHorizonTo || addDaysIso(toDateInputValue(new Date()), BOOKING_HORIZON_DAYS);
    const [year, month] = horizon.split('-').map(Number);
    return this.calendarYear < year || (this.calendarYear === year && this.calendarMonth < month - 1);
  }

  get visibleMonthHasAvailableDate(): boolean {
    return [...this.availableDates].some((date) => {
      const [year, month] = date.split('-').map(Number);
      return year === this.calendarYear && month === this.calendarMonth + 1;
    });
  }

  get activeStepLabel(): string {
    return this.steps.find((step) => step.id === this.activeStep)?.label ?? '';
  }

  getNextRequiredStep(): number {
    if (!this.selectedService) {
      return 1;
    }
    if (!this.selectedLocation) {
      return 2;
    }
    if (!this.selectedDoctor) {
      return 3;
    }
    if (!this.selectedDate) {
      return 4;
    }
    if (!this.selectedTime) {
      return 5;
    }
    if (!this.canContinueFromPatient) {
      return 6;
    }
    return 7;
  }

  isStepComplete(stepId: number): boolean {
    switch (stepId) {
      case 1:
        return Boolean(this.selectedService);
      case 2:
        return Boolean(this.selectedLocation);
      case 3:
        return Boolean(this.selectedDoctor);
      case 4:
        return Boolean(this.selectedDate);
      case 5:
        return Boolean(this.selectedTime);
      case 6:
        return this.canContinueFromPatient;
      default:
        return false;
    }
  }

  stepState(stepId: number): 'done' | 'current' | 'upcoming' {
    if (stepId === this.activeStep) {
      return 'current';
    }
    if (this.isStepComplete(stepId)) {
      return 'done';
    }
    return 'upcoming';
  }

  canOpenStep(stepId: number): boolean {
    return stepId !== this.activeStep && this.isStepComplete(stepId);
  }

  goToStep(stepId: number): void {
    if (!this.canOpenStep(stepId) || this.bookingResult) {
      return;
    }
    this.activeStep = stepId;
  }

  goToPreviousStep(): void {
    if (this.activeStep > 1 && !this.bookingResult) {
      this.activeStep -= 1;
    }
  }

  selectSpecialty(specialtyId: number): void {
    this.selectedSpecialtyId = specialtyId;
  }

  onServiceSearchInput(event: Event): void {
    this.serviceSearchQuery = (event.target as HTMLInputElement).value;
  }

  selectService(service: ClinicService): void {
    if (this.selectedService?.id === service.id) {
      this.advanceToNextRequiredStep();
      return;
    }

    this.selectedService = service;
    this.selectedSpecialtyId = service.specialty.id;
    this.clearSchedule();

    if (this.selectedDoctor && !this.selectedDoctor.serviceIds.map(Number).includes(Number(service.id))) {
      this.selectedDoctor = null;
    }

    this.refreshAvailableDates();
    this.advanceToNextRequiredStep();
  }

  selectLocation(location: ClinicLocation): void {
    if (this.selectedLocation?.id === location.id) {
      this.advanceToNextRequiredStep();
      return;
    }

    this.selectedLocation = location;
    this.clearSchedule();

    if (this.selectedDoctor && !this.selectedDoctor.locationIds.map(Number).includes(Number(location.id))) {
      this.selectedDoctor = null;
    }

    this.refreshAvailableDates();
    this.advanceToNextRequiredStep();
  }

  selectDoctor(doctor: BookingDoctor): void {
    if (this.selectedDoctor?.id === doctor.id) {
      this.advanceToNextRequiredStep();
      return;
    }

    this.selectedDoctor = doctor;
    this.clearSchedule();
    this.refreshAvailableDates();
    this.advanceToNextRequiredStep();
  }

  previousCalendarMonth(): void {
    if (!this.canGoToPreviousMonth) {
      return;
    }
    if (this.calendarMonth === 0) {
      this.calendarMonth = 11;
      this.calendarYear -= 1;
      return;
    }
    this.calendarMonth -= 1;
  }

  nextCalendarMonth(): void {
    if (!this.canGoToNextMonth) {
      return;
    }
    if (this.calendarMonth === 11) {
      this.calendarMonth = 0;
      this.calendarYear += 1;
      return;
    }
    this.calendarMonth += 1;
  }

  isDateAvailable(date: string): boolean {
    return this.availableDates.has(date);
  }

  selectCalendarDate(date: string): void {
    if (this.datesLoading || !this.isDateAvailable(date)) {
      return;
    }

    if (this.selectedDate === date) {
      this.advanceToNextRequiredStep();
      return;
    }

    this.selectedDate = date;
    this.selectedTime = null;
    this.confirmError = '';
    this.loadAvailableTimes();
    this.advanceToNextRequiredStep();
  }

  selectTime(time: string): void {
    if (!this.availableTimes.includes(time)) {
      return;
    }

    this.selectedTime = time;
    this.confirmError = '';
    this.slotConflictMessage = '';
    this.clearAdvanceTimer();
    this.advanceTimer = setTimeout(() => {
      this.activeStep = this.getNextRequiredStep();
    }, 180);
  }

  goToDateStep(): void {
    this.activeStep = 4;
  }

  onJmbgInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 13);
    input.value = digits;
    this.patientForm.controls.jmbg.setValue(digits, { emitEvent: false });
    this.invalidateLookupIfJmbgChanged(digits);
  }

  searchPatient(): void {
    const jmbg = (this.patientForm.controls.jmbg.value ?? '').trim();
    this.patientForm.controls.jmbg.markAsTouched();
    this.lookupError = '';

    if (!/^\d{13}$/.test(jmbg)) {
      this.lookupError = 'JMBG mora sadržati tačno 13 cifara.';
      return;
    }

    this.isSearchingPatient = true;
    this.portalService.lookupPatientByJmbg(jmbg).subscribe({
      next: (result) => {
        this.isSearchingPatient = false;
        this.applyLookupResult(jmbg, result);
      },
      error: (error: HttpErrorResponse) => {
        this.isSearchingPatient = false;
        this.lookupStatus = 'idle';
        this.searchedJmbg = '';
        this.lookupError =
          error.error?.message || 'Trenutno nije moguće pretražiti pacijenta. Pokušajte ponovo.';
      }
    });
  }

  onPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const nationalNumber = formatNationalNumber(input.value);
    input.value = nationalNumber;
    this.patientForm.controls.phone.setValue(nationalNumber ? `+381 ${nationalNumber}` : '', {
      emitEvent: false
    });
  }

  onPhoneBlur(): void {
    this.patientForm.controls.phone.markAsTouched();
  }

  doctorDisplayName(doctor: BookingDoctor): string {
    return `dr ${doctor.firstName} ${doctor.lastName}`;
  }

  summaryValue(value: string | null | undefined): string {
    return value ? value : 'Nije izabrano';
  }

  continueToReview(): void {
    this.patientForm.markAllAsTouched();
    this.lookupError = '';

    if (!this.isLookupCurrent) {
      this.lookupError = 'Pretražite pacijenta po JMBG-u pre nastavka.';
      return;
    }

    if (this.patientForm.invalid) {
      return;
    }

    this.activeStep = 7;
  }

  confirmBooking(): void {
    this.confirmError = '';
    this.patientForm.markAllAsTouched();

    if (this.isSubmitting || this.bookingResult) {
      return;
    }

    if (!this.selectedService || !this.selectedLocation || !this.selectedDoctor) {
      this.confirmError = 'Izaberite uslugu, lokaciju i lekara pre potvrde.';
      return;
    }

    if (!this.isLookupCurrent) {
      this.confirmError = 'Pretražite pacijenta po JMBG-u pre potvrde.';
      this.activeStep = 6;
      return;
    }

    if (this.patientForm.invalid) {
      this.confirmError = 'Popunite podatke pacijenta pre potvrde.';
      this.activeStep = 6;
      return;
    }

    if (!this.selectedDate || !this.selectedTime) {
      this.confirmError = 'Izaberite datum i termin pre potvrde.';
      return;
    }

    const formValue = this.patientForm.getRawValue();
    this.isSubmitting = true;

    this.portalService
      .createAppointment({
        doctorId: this.selectedDoctor.id,
        serviceId: this.selectedService.id,
        locationId: this.selectedLocation.id,
        appointmentDate: this.selectedDate,
        startTime: this.selectedTime,
        firstName: formValue.firstName ?? '',
        lastName: formValue.lastName ?? '',
        jmbg: formValue.jmbg ?? '',
        email: formValue.email ?? '',
        phone: formValue.phone ?? ''
      })
      .subscribe({
        next: (result) => {
          this.isSubmitting = false;
          this.bookingResult = result;
          this.activeStep = 7;
        },
        error: (error: HttpErrorResponse) => {
          this.isSubmitting = false;
          if (error.status === 409) {
            this.handleSlotConflict(error.error?.message);
            return;
          }

          this.confirmError =
            error.error?.message || 'Došlo je do problema prilikom zakazivanja pregleda. Pokušajte ponovo.';
        }
      });
  }

  startAnotherBooking(): void {
    this.bookingResult = null;
    this.selectedService = null;
    this.selectedLocation = null;
    this.selectedDoctor = null;
    this.selectedSpecialtyId = this.displayedSpecialties[0]?.id ?? null;
    this.serviceSearchQuery = '';
    this.clearSchedule();
    this.resetPatientLookup();
    this.activeStep = 1;
  }

  private applyLookupResult(jmbg: string, result: AdminPatientLookup): void {
    this.searchedJmbg = jmbg;
    this.patientForm.controls.jmbg.setValue(jmbg, { emitEvent: false });

    if (result.found && result.patient) {
      this.lookupStatus = 'found';
      this.patientForm.patchValue({
        firstName: result.patient.firstName,
        lastName: result.patient.lastName,
        jmbg: result.patient.jmbg,
        email: result.patient.email,
        phone: toFormPhone(result.patient.phone)
      });
      this.patientForm.markAsUntouched();
      return;
    }

    this.lookupStatus = 'not_found';
    this.patientForm.patchValue({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      jmbg
    });
    this.patientForm.markAsUntouched();
  }

  private invalidateLookupIfJmbgChanged(jmbg: string): void {
    if (jmbg === this.searchedJmbg) {
      return;
    }

    if (this.lookupStatus === 'found') {
      this.patientForm.patchValue({
        firstName: '',
        lastName: '',
        email: '',
        phone: ''
      });
    }

    this.lookupStatus = 'idle';
    this.searchedJmbg = '';
    this.lookupError = '';
  }

  private resetPatientLookup(): void {
    this.lookupStatus = 'idle';
    this.lookupError = '';
    this.searchedJmbg = '';
    this.isSearchingPatient = false;
    this.patientForm.reset({
      firstName: '',
      lastName: '',
      jmbg: '',
      email: '',
      phone: ''
    });
  }

  private handleSlotConflict(message?: string): void {
    this.selectedTime = null;
    this.bookingResult = null;
    this.slotConflictMessage =
      message || 'Nažalost, izabrani termin više nije dostupan. Molimo izaberite drugi termin.';
    this.activeStep = 5;
    this.loadAvailableTimes();
  }

  private loadBookingData(): void {
    this.subscriptions.add(
      forkJoin({
        services: this.clinicServiceApi.getServices(),
        locations: this.locationService.getLocations(),
        doctors: this.doctorService.getDoctors()
      }).subscribe({
        next: ({ services, locations, doctors }) => {
          this.services = sortClinicServices(services);
          this.locations = locations;
          this.doctors = doctors.map((doctor) => toBookingDoctor(doctor));
          this.specialties = collectSpecialties(this.services);
          this.selectedSpecialtyId = this.displayedSpecialties[0]?.id ?? null;
          this.hydrateDoctorRelationships();
        },
        error: () => {
          this.isLoading = false;
          this.loadError = 'Trenutno nije moguće učitati podatke za zakazivanje. Pokušajte ponovo.';
        }
      })
    );
  }

  private hydrateDoctorRelationships(): void {
    const doctorsMissingServices = this.doctors.filter((doctor) => doctor.serviceIds.length === 0);
    if (doctorsMissingServices.length === 0) {
      this.doctorRelationshipsReady = true;
      this.isLoading = false;
      return;
    }

    this.doctorRelationshipsReady = false;
    forkJoin(doctorsMissingServices.map((doctor) => this.doctorService.getDoctorById(doctor.id))).subscribe({
      next: (details) => {
        for (const detail of details) {
          const bookingDoctor = toBookingDoctor(detail);
          const index = this.doctors.findIndex((doctor) => doctor.id === bookingDoctor.id);
          if (index >= 0) {
            this.doctors[index] = { ...this.doctors[index], ...bookingDoctor };
          }
        }
        this.doctorRelationshipsReady = true;
        this.isLoading = false;
      },
      error: () => {
        this.doctorRelationshipsReady = true;
        this.isLoading = false;
      }
    });
  }

  private clearSchedule(): void {
    this.selectedDate = '';
    this.selectedTime = null;
    this.confirmError = '';
    this.availableDates = new Set();
    this.availableTimes = [];
    this.datesError = '';
    this.timesError = '';
    this.datesRequest?.unsubscribe();
    this.timesRequest?.unsubscribe();
    this.datesLoading = false;
    this.timesLoading = false;
  }

  refreshAvailableDates(): void {
    this.datesRequest?.unsubscribe();
    this.availableTimes = [];
    this.timesError = '';

    if (!this.selectedService || !this.selectedLocation || !this.selectedDoctor) {
      this.availableDates = new Set();
      this.datesLoading = false;
      return;
    }

    const from = toDateInputValue(new Date());
    const to = addDaysIso(from, BOOKING_HORIZON_DAYS);
    this.datesLoading = true;
    this.datesError = '';
    this.availableDates = new Set();

    this.datesRequest = this.availabilityApi
      .getAvailableDates({
        doctorId: this.selectedDoctor.id,
        serviceId: this.selectedService.id,
        locationId: this.selectedLocation.id,
        from,
        to
      })
      .subscribe({
        next: (response) => {
          this.datesLoading = false;
          this.datesHorizonTo = response.to;
          this.availableDates = new Set(response.availableDates);
          if (this.selectedDate && !this.availableDates.has(this.selectedDate)) {
            this.selectedDate = '';
            this.selectedTime = null;
            this.availableTimes = [];
          }
          if (this.selectedDate) {
            this.loadAvailableTimes();
          }
        },
        error: () => {
          this.datesLoading = false;
          this.availableDates = new Set();
          this.datesError = 'Došlo je do problema pri učitavanju datuma. Pokušajte ponovo.';
        }
      });
  }

  loadAvailableTimes(): void {
    this.timesRequest?.unsubscribe();
    this.availableTimes = [];

    if (!this.selectedService || !this.selectedLocation || !this.selectedDoctor || !this.selectedDate) {
      this.timesLoading = false;
      return;
    }

    this.timesLoading = true;
    this.timesError = '';

    this.timesRequest = this.availabilityApi
      .getAvailableTimes({
        doctorId: this.selectedDoctor.id,
        serviceId: this.selectedService.id,
        locationId: this.selectedLocation.id,
        date: this.selectedDate
      })
      .subscribe({
        next: (response) => {
          this.timesLoading = false;
          this.availableTimes = response.availableTimes;
          if (this.selectedTime && !this.availableTimes.includes(this.selectedTime)) {
            this.selectedTime = null;
          }
        },
        error: () => {
          this.timesLoading = false;
          this.availableTimes = [];
          this.timesError = 'Došlo je do problema pri učitavanju termina. Pokušajte ponovo.';
        }
      });
  }

  private advanceToNextRequiredStep(): void {
    this.clearAdvanceTimer();
    this.advanceTimer = setTimeout(() => {
      this.activeStep = this.getNextRequiredStep();
    }, 180);
  }

  private clearAdvanceTimer(): void {
    if (this.advanceTimer) {
      clearTimeout(this.advanceTimer);
      this.advanceTimer = null;
    }
  }
}
