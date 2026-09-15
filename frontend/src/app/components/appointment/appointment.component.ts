import { Component, OnDestroy, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { forkJoin, Subscription } from 'rxjs';
import { ClinicService, ClinicServiceApi } from '../../services/clinic-service.service';
import { Doctor, DoctorDetail, DoctorService, Specialty } from '../../services/doctor.service';
import { ClinicLocation, LocationService } from '../../services/location.service';
import { AuthService } from '../../services/auth.service';
import { BookingDraft, BookingDraftService } from '../../services/booking-draft.service';
import { PatientService } from '../../services/patient.service';
import { AppointmentAvailabilityApi, CreatedAppointmentResponse } from '../../services/appointment-availability.service';
import { AppointmentAuthChoiceModalComponent } from './appointment-auth-choice-modal.component';
import { SiteHeaderComponent } from '../site-header/site-header.component';

const SPECIALTY_ORDER = [
  'Kardiologija',
  'Pulmologija',
  'Endokrinologija',
  'Ginekologija',
  'Pedijatrija',
  'Oftalmologija',
  'Otorinolaringologija (ORL)',
  'Hirurgija'
];

const BOOKING_HORIZON_DAYS = 60;
const WEEKDAY_LABELS = ['Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub', 'Ned'];
const BOOKING_STEPS = [
  { id: 1, key: 'service', label: 'Usluga' },
  { id: 2, key: 'location', label: 'Lokacija' },
  { id: 3, key: 'doctor', label: 'Lekar' },
  { id: 4, key: 'date', label: 'Datum' },
  { id: 5, key: 'time', label: 'Termin' },
  { id: 6, key: 'patient', label: 'Podaci' },
  { id: 7, key: 'review', label: 'Potvrda' }
] as const;

export interface BookingDoctor {
  id: number;
  firstName: string;
  lastName: string;
  imageUrl: string | null;
  specialty: Specialty;
  locationIds: number[];
  serviceIds: number[];
}

@Component({
  selector: 'app-appointment',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, ReactiveFormsModule, AppointmentAuthChoiceModalComponent, SiteHeaderComponent],
  templateUrl: './appointment.component.html',
  styleUrl: './appointment.component.css'
})
export class AppointmentComponent implements OnDestroy {
  readonly steps = BOOKING_STEPS;

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
  activeStep = 1;

  isLoading = true;
  loadError = '';
  isAuthenticated = false;
  identityLocked = false;
  confirmMessage = '';
  confirmError = '';
  minDate = this.toDateInputValue(new Date());
  doctorServicesLoading = false;
  doctorRelationshipsReady = false;
  authChoiceOpen = false;
  readonly weekdayLabels = WEEKDAY_LABELS;
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

  private entryDoctorId: number | null = null;
  private guestContinue = false;
  private requestedServiceId: number | null = null;
  private requestedDoctorId: number | null = null;
  private dataReady = false;
  private timeAcknowledged = false;
  private advanceTimer: ReturnType<typeof setTimeout> | null = null;
  private datesRequest: Subscription | null = null;
  private timesRequest: Subscription | null = null;

  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly bookingDraft = inject(BookingDraftService);
  private readonly clinicServiceApi = inject(ClinicServiceApi);
  private readonly locationService = inject(LocationService);
  private readonly doctorService = inject(DoctorService);
  private readonly authService = inject(AuthService);
  private readonly patientService = inject(PatientService);
  private readonly availabilityApi = inject(AppointmentAvailabilityApi);
  private readonly subscriptions = new Subscription();

  patientForm = this.fb.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    jmbg: ['', [Validators.required, Validators.pattern(/^\d{13}$/)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, Validators.pattern(/^\+381 \d{2} \d{3} \d{4}$/)]]
  });

  constructor() {
    this.subscriptions.add(
      this.route.queryParamMap.subscribe((params) => {
        this.requestedServiceId = this.parsePositiveId(params.get('service'));
        this.requestedDoctorId = this.parsePositiveId(params.get('doctor'));
        if (this.dataReady && (this.requestedServiceId || this.requestedDoctorId)) {
          this.bookingDraft.clear();
          this.applyQuerySelection();
        }
      })
    );

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
    if (this.patientForm.invalid) {
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
        return this.patientForm.valid;
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
    if (!this.canOpenStep(stepId)) {
      return;
    }
    this.activeStep = stepId;
  }

  goToPreviousStep(): void {
    if (this.activeStep > 1) {
      this.activeStep -= 1;
    }
  }

  continueFromTime(): void {
    if (!this.selectedTime) {
      return;
    }
    if (this.authService.isLoggedIn()) {
      this.proceedToPatientData();
      return;
    }

    if (this.guestContinue) {
      this.proceedToPatientData();
      return;
    }

    this.authChoiceOpen = true;
  }

  closeAuthChoice(): void {
    this.authChoiceOpen = false;
  }

  continueAsGuest(): void {
    this.guestContinue = true;
    this.authChoiceOpen = false;
    this.proceedToPatientData();
  }

  goToLoginFromBooking(): void {
    this.persistBookingForAuth();
    this.authChoiceOpen = false;
    void this.router.navigate(['/prijava'], {
      queryParams: { returnUrl: '/appointment' }
    });
  }

  goToRegisterFromBooking(): void {
    this.persistBookingForAuth();
    this.authChoiceOpen = false;
    void this.router.navigate(['/registracija'], {
      queryParams: { returnUrl: '/appointment' }
    });
  }

  continueToReview(): void {
    this.patientForm.markAllAsTouched();
    if (this.patientForm.invalid) {
      return;
    }
    this.activeStep = 7;
  }

  get activeStepLabel(): string {
    return this.steps.find((step) => step.id === this.activeStep)?.label ?? '';
  }

  stepIndexLabel(stepId: number): string {
    return String(stepId).padStart(2, '0');
  }

  get displayedServices(): ClinicService[] {
    if (this.entryDoctorId && this.selectedDoctor?.id === this.entryDoctorId) {
      const serviceIds = new Set(this.selectedDoctor.serviceIds.map(Number));
      return this.services.filter((service) => serviceIds.has(Number(service.id)));
    }
    return this.services;
  }

  get displayedSpecialties(): Specialty[] {
    const ids = new Set(this.displayedServices.map((service) => service.specialty.id));
    return this.specialties.filter((specialty) => ids.has(specialty.id));
  }

  get specialtyServices(): ClinicService[] {
    if (this.entryDoctorId && this.selectedDoctor?.id === this.entryDoctorId) {
      return this.displayedServices;
    }

    if (this.selectedSpecialtyId === null) {
      return this.displayedServices;
    }

    return this.displayedServices.filter((service) => service.specialty.id === this.selectedSpecialtyId);
  }

  get displayedLocations(): ClinicLocation[] {
    if (this.entryDoctorId && this.selectedDoctor?.id === this.entryDoctorId) {
      const locationIds = new Set(this.selectedDoctor.locationIds.map(Number));
      return this.locations.filter((location) => locationIds.has(Number(location.id)));
    }
    return this.locations;
  }

  get eligibleDoctors(): BookingDoctor[] {
    if (!this.selectedService || !this.selectedLocation) {
      return this.selectedDoctor ? [this.selectedDoctor] : [];
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

  get phoneNationalNumber(): string {
    const value = this.patientForm.controls.phone.value ?? '';
    return value.replace(/^\+381\s*/, '');
  }

  selectSpecialty(specialtyId: number): void {
    this.selectedSpecialtyId = specialtyId;
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
      this.clearDoctorSelection();
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
      this.clearDoctorSelection();
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

  get calendarTitle(): string {
    const date = new Date(this.calendarYear, this.calendarMonth, 1);
    return date.toLocaleDateString('sr-RS', { month: 'long', year: 'numeric' });
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
          date: this.toDateInputValue(cursor),
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
    const horizon = this.datesHorizonTo || this.addDaysIso(this.toDateInputValue(new Date()), BOOKING_HORIZON_DAYS);
    const [year, month] = horizon.split('-').map(Number);
    return (
      this.calendarYear < year ||
      (this.calendarYear === year && this.calendarMonth < month - 1)
    );
  }

  get visibleMonthHasAvailableDate(): boolean {
    return [...this.availableDates].some((date) => {
      const [year, month] = date.split('-').map(Number);
      return year === this.calendarYear && month === this.calendarMonth + 1;
    });
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
    this.timeAcknowledged = false;
    this.confirmMessage = '';
    this.loadAvailableTimes();
    this.advanceToNextRequiredStep();
  }

  selectTime(time: string): void {
    if (!this.availableTimes.includes(time)) {
      return;
    }

    this.selectedTime = time;
    this.timeAcknowledged = true;
    this.confirmMessage = '';
    this.slotConflictMessage = '';
    this.clearAdvanceTimer();
    this.advanceTimer = setTimeout(() => {
      this.continueFromTime();
    }, 180);
  }

  goToDateStep(): void {
    this.activeStep = 4;
  }

  onPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const nationalNumber = this.formatNationalNumber(input.value);
    input.value = nationalNumber;
    this.patientForm.controls.phone.setValue(
      nationalNumber ? `+381 ${nationalNumber}` : '',
      { emitEvent: false }
    );
  }

  onPhoneBlur(): void {
    this.patientForm.controls.phone.markAsTouched();
  }

  doctorDisplayName(doctor: BookingDoctor): string {
    return `dr ${doctor.firstName} ${doctor.lastName}`;
  }

  formatPrice(price: number): string {
    return `${new Intl.NumberFormat('sr-RS', { maximumFractionDigits: 0 }).format(price)} RSD`;
  }

  formatDuration(minutes: number): string {
    return `${minutes} min`;
  }

  formatDisplayDate(value: string): string {
    if (!value) {
      return '';
    }

    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('sr-RS', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  summaryValue(value: string | null | undefined): string {
    return value ? value : 'Nije izabrano';
  }

  confirmBooking(): void {
    this.confirmMessage = '';
    this.confirmError = '';
    this.patientForm.markAllAsTouched();

    if (this.isSubmitting || this.bookingResult) {
      return;
    }

    if (!this.selectedService || !this.selectedLocation || !this.selectedDoctor) {
      this.confirmError = 'Izaberite uslugu, lokaciju i lekara pre potvrde.';
      return;
    }

    if (this.patientForm.invalid) {
      this.confirmError = 'Popunite podatke pacijenta pre potvrde.';
      return;
    }

    if (!this.selectedDate || !this.selectedTime) {
      this.confirmError = 'Izaberite datum i termin pre potvrde.';
      return;
    }

    const formValue = this.patientForm.getRawValue();
    this.isSubmitting = true;

    this.availabilityApi.createAppointment({
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
    }).subscribe({
      next: (result) => {
        this.isSubmitting = false;
        this.bookingResult = result;
        this.bookingDraft.clear();
        this.activeStep = 7;
      },
      error: (error: HttpErrorResponse) => {
        this.isSubmitting = false;
        if (error.status === 409) {
          this.handleSlotConflict();
          return;
        }

        this.confirmError = 'Došlo je do problema prilikom zakazivanja pregleda. Pokušajte ponovo.';
      }
    });
  }

  private handleSlotConflict(): void {
    this.selectedTime = null;
    this.timeAcknowledged = false;
    this.bookingResult = null;
    this.slotConflictMessage =
      'Nažalost, izabrani termin više nije dostupan. Molimo izaberite drugi termin.';
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
          this.services = this.sortServices(services);
          this.locations = locations;
          this.doctors = doctors.map((doctor) => this.toBookingDoctor(doctor));
          this.specialties = this.collectSpecialties(this.services);
          this.hydrateDoctorRelationships();
        },
        error: (error: HttpErrorResponse) => {
          console.error('Greška pri učitavanju podataka za zakazivanje:', error);
          this.isLoading = false;
          this.loadError = 'Trenutno nije moguće učitati podatke za zakazivanje. Pokušajte ponovo.';
        }
      })
    );
  }

  private loadPatientProfile(): void {
    this.isAuthenticated = this.authService.isLoggedIn();
    if (!this.isAuthenticated) {
      return;
    }

    this.patientService.getMe().subscribe({
      next: (patient) => {
        const jmbg = String(patient.jmbg ?? '').trim();
        const phone = this.toFormPhone(patient.phone ?? '');

        this.patientForm.patchValue({
          firstName: patient.firstName,
          lastName: patient.lastName,
          email: patient.email,
          jmbg,
          phone
        });

        this.identityLocked = true;
      },
      error: () => {
        this.isAuthenticated = false;
        this.identityLocked = false;
      }
    });
  }

  private hydrateDoctorRelationships(): void {
    const doctorsMissingServices = this.doctors.filter((doctor) => doctor.serviceIds.length === 0);

    if (doctorsMissingServices.length === 0) {
      this.doctorRelationshipsReady = true;
      this.hydrateEntryDoctor();
      return;
    }

    this.doctorRelationshipsReady = false;
    forkJoin(
      doctorsMissingServices.map((doctor) => this.doctorService.getDoctorById(doctor.id))
    ).subscribe({
      next: (details) => {
        for (const detail of details) {
          this.mergeDoctorDetail(detail);
        }
        this.doctorRelationshipsReady = true;
        this.hydrateEntryDoctor();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Greška pri učitavanju usluga lekara:', error);
        this.doctorRelationshipsReady = true;
        this.hydrateEntryDoctor();
      }
    });
  }

  private hydrateEntryDoctor(): void {
    if (!this.requestedDoctorId) {
      this.finishBookingLoad();
      return;
    }

    this.doctorServicesLoading = true;
    this.doctorService.getDoctorById(this.requestedDoctorId).subscribe({
      next: (detail) => {
        this.mergeDoctorDetail(detail);
        this.doctorServicesLoading = false;
        this.finishBookingLoad();
      },
      error: () => {
        this.doctorServicesLoading = false;
        this.finishBookingLoad();
      }
    });
  }

  private finishBookingLoad(): void {
    this.dataReady = true;
    this.isLoading = false;

    const hasQueryEntry = Boolean(this.requestedServiceId || this.requestedDoctorId);
    if (hasQueryEntry) {
      this.bookingDraft.clear();
      this.applyQuerySelection();
      this.loadPatientProfile();
      return;
    }

    const resumeDraft = this.bookingDraft.consumeResumeDraft();
    if (resumeDraft && this.restoreDraft(resumeDraft)) {
      this.loadPatientProfile();
      if (this.authService.isLoggedIn()) {
        this.proceedToPatientData();
      }
      return;
    }

    this.applyQuerySelection();
    this.loadPatientProfile();
    this.refreshAvailableDates();
  }

  private proceedToPatientData(): void {
    this.timeAcknowledged = true;
    this.activeStep = this.getNextRequiredStep();
  }

  private persistBookingForAuth(): void {
    this.bookingDraft.save({
      serviceId: this.selectedService?.id ?? null,
      locationId: this.selectedLocation?.id ?? null,
      doctorId: this.selectedDoctor?.id ?? null,
      entryDoctorId: this.entryDoctorId,
      appointmentDate: this.selectedDate,
      appointmentTime: this.selectedTime,
      timeAcknowledged: true,
      resumeAfterAuth: true
    });
  }

  private restoreDraft(draft: BookingDraft): boolean {
    const service = draft.serviceId
      ? this.services.find((item) => Number(item.id) === Number(draft.serviceId)) ?? null
      : null;
    const location = draft.locationId
      ? this.locations.find((item) => Number(item.id) === Number(draft.locationId)) ?? null
      : null;
    const doctor = draft.doctorId
      ? this.doctors.find((item) => Number(item.id) === Number(draft.doctorId)) ?? null
      : null;

    if (service && doctor && !doctor.serviceIds.map(Number).includes(Number(service.id))) {
      return false;
    }

    if (location && doctor && !doctor.locationIds.map(Number).includes(Number(location.id))) {
      return false;
    }

    this.selectedService = service;
    this.selectedLocation = location;
    this.selectedDoctor = doctor;
    this.entryDoctorId = draft.entryDoctorId && doctor?.id === Number(draft.entryDoctorId)
      ? doctor.id
      : null;
    this.selectedSpecialtyId = service?.specialty.id ?? this.displayedServices[0]?.specialty.id ?? null;
    this.selectedDate = draft.appointmentDate || '';
    this.selectedTime = draft.appointmentTime;
    this.timeAcknowledged = false;
    this.activeStep = this.getNextRequiredStep();
    this.refreshAvailableDates();
    if (this.selectedDate) {
      this.loadAvailableTimes();
    }
    return Boolean(service || location || doctor || this.selectedDate);
  }

  private mergeDoctorDetail(detail: DoctorDetail): void {
    const bookingDoctor = this.toBookingDoctorFromDetail(detail);
    const index = this.doctors.findIndex((doctor) => doctor.id === bookingDoctor.id);

    if (index >= 0) {
      this.doctors[index] = {
        ...this.doctors[index],
        ...bookingDoctor
      };
      return;
    }

    this.doctors.push(bookingDoctor);
  }

  private applyQuerySelection(): void {
    const doctor = this.requestedDoctorId
      ? this.doctors.find((item) => item.id === this.requestedDoctorId) ?? null
      : null;
    const service = this.requestedServiceId
      ? this.services.find((item) => item.id === this.requestedServiceId) ?? null
      : null;

    this.entryDoctorId = doctor?.id ?? null;
    this.selectedDoctor = doctor;
    this.selectedLocation = null;
    this.clearSchedule();

    if (service && doctor && !doctor.serviceIds.map(Number).includes(Number(service.id))) {
      this.selectedService = null;
      this.selectedSpecialtyId = this.displayedServices[0]?.specialty.id ?? null;
      this.activeStep = this.getNextRequiredStep();
      return;
    }

    this.selectedService = service;
    this.selectedSpecialtyId =
      service?.specialty.id ?? this.displayedServices[0]?.specialty.id ?? null;
    this.activeStep = this.getNextRequiredStep();
  }

  private clearDoctorSelection(): void {
    this.selectedDoctor = null;
    this.entryDoctorId = null;
    if (this.selectedService) {
      this.selectedSpecialtyId = this.selectedService.specialty.id;
    }
  }

  private clearSchedule(): void {
    this.selectedDate = '';
    this.selectedTime = null;
    this.timeAcknowledged = false;
    this.confirmMessage = '';
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

    const from = this.toDateInputValue(new Date());
    const to = this.addDaysIso(from, BOOKING_HORIZON_DAYS);
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

  private addDaysIso(isoDate: string, days: number): string {
    const [year, month, day] = isoDate.split('-').map(Number);
    const date = new Date(year, month - 1, day + days);
    return this.toDateInputValue(date);
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

  private toBookingDoctor(doctor: Doctor): BookingDoctor {
    return {
      id: Number(doctor.id),
      firstName: doctor.firstName,
      lastName: doctor.lastName,
      imageUrl: doctor.imageUrl,
      specialty: doctor.specialty,
      locationIds: (doctor.locations ?? []).map((location) => Number(location.id)),
      serviceIds: (doctor.services ?? []).map((service) => Number(service.id))
    };
  }

  private toBookingDoctorFromDetail(detail: DoctorDetail): BookingDoctor {
    return {
      id: Number(detail.id),
      firstName: detail.firstName,
      lastName: detail.lastName,
      imageUrl: detail.imageUrl,
      specialty: detail.specialty,
      locationIds: (detail.locations ?? []).map((location) => Number(location.id)),
      serviceIds: (detail.services ?? []).map((service) => Number(service.id))
    };
  }

  private collectSpecialties(services: ClinicService[]): Specialty[] {
    const byId = new Map<number, Specialty>();
    for (const service of services) {
      byId.set(service.specialty.id, service.specialty);
    }

    return [...byId.values()].sort((a, b) => {
      const indexA = SPECIALTY_ORDER.indexOf(a.name);
      const indexB = SPECIALTY_ORDER.indexOf(b.name);
      return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
    });
  }

  private sortServices(services: ClinicService[]): ClinicService[] {
    return [...services].sort((a, b) => {
      const indexA = SPECIALTY_ORDER.indexOf(a.specialty.name);
      const indexB = SPECIALTY_ORDER.indexOf(b.specialty.name);
      if (indexA !== indexB) {
        return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
      }
      return a.name.localeCompare(b.name, 'sr');
    });
  }

  private parsePositiveId(value: string | null): number | null {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return null;
    }
    return parsed;
  }

  private toDateInputValue(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatNationalNumber(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 9);
    const parts = [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 9)];
    return parts.filter(Boolean).join(' ');
  }

  private toFormPhone(phone: string): string {
    const trimmed = phone.trim();
    if (!trimmed) {
      return '';
    }

    if (/^\+381 \d{2} \d{3} \d{4}$/.test(trimmed)) {
      return trimmed;
    }

    let digits = trimmed.replace(/\D/g, '');
    if (digits.startsWith('381')) {
      digits = digits.slice(3);
    }
    if (digits.startsWith('0')) {
      digits = digits.slice(1);
    }

    const nationalNumber = this.formatNationalNumber(digits);
    return nationalNumber ? `+381 ${nationalNumber}` : '';
  }
}
