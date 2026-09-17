import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { LucideArrowLeft, LucideCheck, LucideCircleAlert, LucideCircleCheck, LucideImageUp, LucideUserRound } from '@lucide/angular';
import {
  AdminDoctorDetail,
  AdminDoctorSchedule,
  AdminDoctorUpdatePayload,
  AdminPortalService
} from '../../services/admin-portal.service';
import { ClinicService, ClinicServiceApi } from '../../services/clinic-service.service';
import { DoctorService, Specialty } from '../../services/doctor.service';
import { ClinicLocation, LocationService } from '../../services/location.service';
import { resolveMediaUrl } from '../../utils/media-url';

interface ScheduleDay {
  dayOfWeek: number;
  label: string;
  works: boolean;
  startTime: string;
  endTime: string;
  locationId: number | null;
}

const WEEKDAYS: { dayOfWeek: number; label: string }[] = [
  { dayOfWeek: 1, label: 'Ponedeljak' },
  { dayOfWeek: 2, label: 'Utorak' },
  { dayOfWeek: 3, label: 'Sreda' },
  { dayOfWeek: 4, label: 'Četvrtak' },
  { dayOfWeek: 5, label: 'Petak' },
  { dayOfWeek: 6, label: 'Subota' },
  { dayOfWeek: 7, label: 'Nedelja' }
];

@Component({
  selector: 'app-admin-doctor-detail',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './admin-doctor-detail.component.html',
  styleUrls: [
    './admin-doctor-detail.component.css',
    './admin-doctor-detail-editor.css'
  ]
})
export class AdminDoctorDetailComponent implements OnInit, OnDestroy {
  @Input() createMode = false;

  readonly userIcon = LucideUserRound.icon.node;
  readonly checkIcon = LucideCheck.icon.node;
  readonly successIcon = LucideCircleCheck.icon.node;
  readonly alertIcon = LucideCircleAlert.icon.node;
  readonly uploadIcon = LucideImageUp.icon.node;
  readonly backIcon = LucideArrowLeft.icon.node;

  @ViewChild('saveFeedback') private saveFeedback?: ElementRef<HTMLElement>;

  doctorId = 0;
  isCreate = false;
  isLoading = true;
  loadError = '';
  notFound = false;
  imageFailed = false;
  isSaving = false;
  saveError = '';
  saveSuccess = '';
  firstNameError = '';
  lastNameError = '';
  confirmKind: 'leave' | 'specialty' | null = null;
  pendingSpecialtyId: number | null = null;

  firstName = '';
  lastName = '';
  specialtyId = 0;
  imageUrl = '';
  biography = '';
  education = '';
  professionalExperience = '';
  locationIds: number[] = [];
  serviceIds: number[] = [];
  days: ScheduleDay[] = [];
  pendingImageFile: File | null = null;
  private previewObjectUrl = '';
  activeTab: 'profile' | 'places' | 'schedule' = 'profile';

  specialties: Specialty[] = [];
  locations: ClinicLocation[] = [];
  specialtyServices: ClinicService[] = [];

  private snapshot = '';
  private successTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly portalService = inject(AdminPortalService);
  private readonly doctorService = inject(DoctorService);
  private readonly locationService = inject(LocationService);
  private readonly clinicServiceApi = inject(ClinicServiceApi);

  ngOnInit(): void {
    this.isCreate = this.createMode || this.route.snapshot.routeConfig?.path === 'new';
    if (this.isCreate) {
      this.initCreateForm();
      return;
    }

    this.route.paramMap.subscribe((params) => {
      this.loadDoctor(Number(params.get('id')));
    });
  }

  ngOnDestroy(): void {
    this.clearSuccessTimer();
    this.revokePreviewUrl();
  }

  retryLoad(): void {
    if (this.isCreate) {
      this.initCreateForm();
      return;
    }
    this.loadDoctor(this.doctorId || Number(this.route.snapshot.paramMap.get('id')));
  }

  headerTitle(): string {
    if (!this.isCreate) {
      return this.doctorName();
    }
    const first = this.firstName.trim();
    const last = this.lastName.trim();
    if (first && last) {
      return `dr ${first} ${last}`;
    }
    return 'Dodavanje novog lekara';
  }

  headerLead(): string {
    if (!this.isCreate) {
      return this.specialtyName();
    }
    return this.specialtyName() || 'Unesite podatke novog lekara u sistem.';
  }

  photoButtonLabel(): string {
    if (this.pendingImageFile) {
      return 'Promeni fotografiju';
    }
    return this.isCreate ? 'Dodaj fotografiju' : 'Promeni fotografiju';
  }

  photoPreviewUrl(): string {
    if (this.previewObjectUrl) {
      return this.previewObjectUrl;
    }
    return resolveMediaUrl(this.imageUrl);
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }

    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!allowed.has(file.type)) {
      this.activeTab = 'profile';
      this.showSaveError('Fotografija mora biti JPG, PNG ili WebP.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.activeTab = 'profile';
      this.showSaveError('Fotografija ne može biti veća od 5 MB.');
      return;
    }

    this.clearSaveSuccess();
    this.saveError = '';
    this.pendingImageFile = file;
    this.revokePreviewUrl();
    this.previewObjectUrl = URL.createObjectURL(file);
    this.imageFailed = false;
  }

  onImageError(): void {
    this.imageFailed = true;
  }

  doctorName(): string {
    const first = this.firstName.trim();
    const last = this.lastName.trim();
    if (!first && !last) {
      return 'Lekar';
    }
    return `dr ${first} ${last}`.trim();
  }

  specialtyName(): string {
    return this.specialties.find((specialty) => specialty.id === this.specialtyId)?.name ?? '';
  }

  selectedLocations(): ClinicLocation[] {
    return this.locations.filter((location) => this.locationIds.includes(location.id));
  }

  isLocationSelected(id: number): boolean {
    return this.locationIds.includes(id);
  }

  toggleLocation(id: number): void {
    if (this.locationIds.includes(id)) {
      this.locationIds = this.locationIds.filter((locationId) => locationId !== id);
      for (const day of this.days) {
        if (day.locationId === id) {
          day.locationId = this.locationIds[0] ?? null;
        }
      }
    } else {
      this.locationIds = [...this.locationIds, id];
    }
  }

  isServiceSelected(id: number): boolean {
    return this.serviceIds.includes(id);
  }

  toggleService(id: number): void {
    if (this.serviceIds.includes(id)) {
      this.serviceIds = this.serviceIds.filter((serviceId) => serviceId !== id);
    } else {
      this.serviceIds = [...this.serviceIds, id];
    }
  }

  onSpecialtyChange(nextId: number): void {
    if (nextId === this.specialtyId) {
      return;
    }

    if (!nextId) {
      this.specialtyId = 0;
      this.specialtyServices = [];
      this.serviceIds = [];
      return;
    }

    this.clinicServiceApi.getServices(nextId).subscribe({
      next: (services) => {
        const allowed = new Set(services.map((service) => service.id));
        const invalid = this.serviceIds.filter((serviceId) => !allowed.has(serviceId));
        if (invalid.length > 0) {
          this.pendingSpecialtyId = nextId;
          this.confirmKind = 'specialty';
          return;
        }
        this.applySpecialty(nextId, services);
      },
      error: () => {
        this.showSaveError('Trenutno nije moguće učitati usluge za izabranu specijalizaciju.');
      }
    });
  }

  readonly hourOptions = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'));
  readonly minuteOptions = ['00', '15', '30', '45'];

  onWorksToggle(day: ScheduleDay): void {
    if (day.works) {
      day.startTime = day.startTime || '08:00';
      day.endTime = day.endTime || '14:00';
      day.locationId = day.locationId ?? this.locationIds[0] ?? null;
    }
  }

  hourOf(time: string): string {
    return (time || '08:00').slice(0, 2);
  }

  minuteOf(time: string): string {
    return (time || '08:00').slice(3, 5);
  }

  minuteChoices(time: string): string[] {
    const minute = this.minuteOf(time);
    if (this.minuteOptions.includes(minute)) {
      return this.minuteOptions;
    }
    return [...this.minuteOptions, minute].sort();
  }

  setHour(day: ScheduleDay, field: 'startTime' | 'endTime', hour: string): void {
    day[field] = `${hour}:${this.minuteOf(day[field])}`;
  }

  setMinute(day: ScheduleDay, field: 'startTime' | 'endTime', minute: string): void {
    day[field] = `${this.hourOf(day[field])}:${minute}`;
  }

  selectTab(tab: 'profile' | 'places' | 'schedule'): void {
    this.activeTab = tab;
  }

  hasUnsavedChanges(): boolean {
    return this.isDirty();
  }

  onBack(): void {
    if (this.isDirty()) {
      this.confirmKind = 'leave';
      return;
    }
    void this.router.navigate(['/admin/doctors']);
  }

  confirmAction(): void {
    if (this.confirmKind === 'leave') {
      this.confirmKind = null;
      this.snapshot = this.serialize();
      void this.router.navigate(['/admin/doctors']);
      return;
    }

    if (this.confirmKind === 'specialty' && this.pendingSpecialtyId) {
      const nextId = this.pendingSpecialtyId;
      this.confirmKind = null;
      this.pendingSpecialtyId = null;
      this.clinicServiceApi.getServices(nextId).subscribe({
        next: (services) => this.applySpecialty(nextId, services)
      });
    }
  }

  cancelConfirm(): void {
    this.confirmKind = null;
    this.pendingSpecialtyId = null;
  }

  confirmTitle(): string {
    return this.confirmKind === 'leave' ? 'Nesačuvane izmene' : 'Promena specijalizacije';
  }

  confirmMessage(): string {
    if (this.confirmKind === 'leave') {
      return 'Imate nesačuvane izmene. Da li želite da napustite stranicu?';
    }
    return 'Promena specijalizacije ukloniće usluge koje joj ne pripadaju. Da li želite da nastavite?';
  }

  clearSaveSuccess(): void {
    if (!this.saveSuccess) {
      return;
    }
    this.saveSuccess = '';
    this.clearSuccessTimer();
  }

  save(): void {
    if (!this.isCreate && !this.isDirty()) {
      return;
    }
    this.saveError = '';
    this.clearSaveSuccess();
    this.firstNameError = this.firstName.trim() ? '' : 'Ime je obavezno.';
    this.lastNameError = this.lastName.trim() ? '' : 'Prezime je obavezno.';

    if (this.firstNameError || this.lastNameError || !this.specialtyId) {
      this.activeTab = 'profile';
      this.showSaveError(this.specialtyId ? 'Proverite obavezna polja.' : 'Specijalizacija je obavezna.');
      return;
    }

    if (this.isCreate && this.locationIds.length === 0) {
      this.activeTab = 'places';
      this.showSaveError('Izaberite najmanje jednu lokaciju na kojoj lekar radi.');
      return;
    }

    if (this.isCreate && this.serviceIds.length === 0) {
      this.activeTab = 'places';
      this.showSaveError('Izaberite najmanje jednu uslugu koju lekar pruža.');
      return;
    }

    for (const day of this.days) {
      if (!day.works) {
        continue;
      }
      if (!day.startTime) {
        this.activeTab = 'schedule';
        this.showSaveError('Unesite vreme početka za svaki radni dan.');
        return;
      }
      if (!day.endTime) {
        this.activeTab = 'schedule';
        this.showSaveError('Unesite vreme završetka za svaki radni dan.');
        return;
      }
      if (day.startTime >= day.endTime) {
        this.activeTab = 'schedule';
        this.showSaveError('Vreme početka mora biti pre vremena završetka.');
        return;
      }
      if (!day.locationId || !this.locationIds.includes(day.locationId)) {
        this.activeTab = 'schedule';
        this.showSaveError(
          this.locationIds.length === 0
            ? 'Najpre izaberite najmanje jednu lokaciju na kojoj lekar radi.'
            : 'Za svaki radni dan izaberite lokaciju na kojoj lekar radi.'
        );
        return;
      }
    }

    if (this.isSaving) {
      return;
    }

    this.isSaving = true;
    const payload = this.buildPayload();
    const save$ = this.isCreate ? this.createDoctorRequest(payload) : this.updateDoctorRequest(payload);

    save$.subscribe({
      next: (result) => {
        this.isSaving = false;
        if (this.isCreate) {
          this.snapshot = this.serialize();
          void this.router.navigate(['/admin/doctors', result.doctor.id], {
            state: {
              doctorCreated: true,
              photoFailed: result.photoFailed
            }
          });
          return;
        }
        this.applyDoctor(result.doctor);
        this.showSaveSuccess('Izmene su uspešno sačuvane.');
      },
      error: (error: HttpErrorResponse) => {
        this.isSaving = false;
        const fallback = this.isCreate
          ? 'Trenutno nije moguće dodati lekara.'
          : 'Trenutno nije moguće sačuvati izmene.';
        const message = error.error?.message || fallback;
        this.showTabForError(message);
        this.showSaveError(message);
      }
    });
  }

  primaryActionLabel(): string {
    if (this.isCreate) {
      return this.isSaving ? 'Dodavanje...' : 'Dodaj lekara';
    }
    return this.isSaving ? 'Čuvanje...' : 'Sačuvaj izmene';
  }

  private createDoctorRequest(payload: AdminDoctorUpdatePayload) {
    const createPayload: AdminDoctorUpdatePayload = { ...payload, imageUrl: null };
    return this.portalService.createDoctor(createPayload).pipe(
      switchMap((doctor) => {
        if (!this.pendingImageFile) {
          return of({ doctor, photoFailed: false });
        }

        return this.portalService.uploadDoctorImage(doctor.id, this.pendingImageFile).pipe(
          switchMap((result) =>
            this.portalService.updateDoctor(doctor.id, {
              ...createPayload,
              imageUrl: result.imageUrl
            })
          ),
          map((updated) => ({ doctor: updated, photoFailed: false })),
          catchError(() => of({ doctor, photoFailed: true }))
        );
      })
    );
  }

  private updateDoctorRequest(payload: AdminDoctorUpdatePayload) {
    const request$ = this.pendingImageFile
      ? this.portalService.uploadDoctorImage(this.doctorId, this.pendingImageFile).pipe(
          switchMap((result) =>
            this.portalService.updateDoctor(this.doctorId, {
              ...payload,
              imageUrl: result.imageUrl
            })
          )
        )
      : this.portalService.updateDoctor(this.doctorId, payload);

    return request$.pipe(map((doctor) => ({ doctor, photoFailed: false })));
  }

  private initCreateForm(): void {
    this.isLoading = true;
    this.loadError = '';
    this.notFound = false;
    this.saveError = '';
    this.clearSaveSuccess();
    this.imageFailed = false;
    this.revokePreviewUrl();
    this.pendingImageFile = null;
    this.activeTab = 'profile';
    this.doctorId = 0;
    this.firstName = '';
    this.lastName = '';
    this.specialtyId = 0;
    this.imageUrl = '';
    this.biography = '';
    this.education = '';
    this.professionalExperience = '';
    this.locationIds = [];
    this.serviceIds = [];
    this.specialtyServices = [];
    this.days = WEEKDAYS.map((weekday) => ({
      dayOfWeek: weekday.dayOfWeek,
      label: weekday.label,
      works: false,
      startTime: '08:00',
      endTime: '14:00',
      locationId: null
    }));
    this.snapshot = this.serialize();

    forkJoin({
      specialties: this.doctorService.getSpecialties(),
      locations: this.locationService.getLocations()
    }).subscribe({
      next: ({ specialties, locations }) => {
        this.specialties = specialties;
        this.locations = locations;
        this.snapshot = this.serialize();
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.loadError = 'Trenutno nije moguće učitati podatke za novog lekara.';
      }
    });
  }

  private loadDoctor(id: number): void {
    this.isLoading = true;
    this.loadError = '';
    this.notFound = false;
    this.saveError = '';
    this.clearSaveSuccess();
    this.imageFailed = false;
    this.revokePreviewUrl();
    this.pendingImageFile = null;
    this.activeTab = 'profile';
    this.doctorId = id;

    if (!Number.isInteger(id) || id <= 0) {
      this.isLoading = false;
      this.notFound = true;
      return;
    }

    forkJoin({
      doctor: this.portalService.getDoctor(id),
      specialties: this.doctorService.getSpecialties(),
      locations: this.locationService.getLocations()
    }).subscribe({
      next: ({ doctor, specialties, locations }) => {
        this.specialties = specialties;
        this.locations = locations;
        this.applyDoctor(doctor);
        this.clinicServiceApi.getServices(doctor.specialty.id).subscribe({
          next: (services) => {
            this.specialtyServices = services;
            this.isLoading = false;
            this.revealCreatedFeedback();
          },
          error: () => {
            this.specialtyServices = [];
            this.isLoading = false;
            this.revealCreatedFeedback();
          }
        });
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading = false;
        if (error.status === 404) {
          this.notFound = true;
          return;
        }
        this.loadError = error.error?.message || 'Trenutno nije moguće učitati lekara.';
      }
    });
  }

  private revealCreatedFeedback(): void {
    const navState = history.state as { doctorCreated?: boolean; photoFailed?: boolean } | undefined;
    if (navState?.photoFailed) {
      this.showSaveError('Lekar je dodat, ali fotografija nije sačuvana. Pokušajte ponovo da je otpremite.');
      return;
    }
    if (navState?.doctorCreated) {
      this.showSaveSuccess('Lekar je uspešno dodat.');
    }
  }

  private showTabForError(message: string): void {
    const text = message.toLowerCase();
    if (
      text.includes('raspored') ||
      text.includes('radno vreme') ||
      text.includes('radni dan') ||
      text.includes('vreme početka') ||
      text.includes('vreme završetka') ||
      text.includes('smenu') ||
      text.includes('termin') ||
      text.includes('zakazan')
    ) {
      this.activeTab = 'schedule';
      return;
    }
    if (text.includes('lokacij') || text.includes('uslug')) {
      this.activeTab = 'places';
      return;
    }
    if (text.includes('ime') || text.includes('prezime') || text.includes('specijaliz') || text.includes('fotograf')) {
      this.activeTab = 'profile';
    }
  }

  private showSaveSuccess(message: string): void {
    this.saveError = '';
    this.saveSuccess = message;
    this.clearSuccessTimer();
    this.successTimer = setTimeout(() => {
      this.saveSuccess = '';
      this.successTimer = null;
    }, 4000);
    this.revealFeedback();
  }

  private showSaveError(message: string): void {
    this.clearSaveSuccess();
    this.saveError = message;
    this.revealFeedback();
  }

  private revealFeedback(): void {
    setTimeout(() => {
      const el = this.saveFeedback?.nativeElement;
      if (!el) {
        return;
      }
      const rect = el.getBoundingClientRect();
      const viewHeight = window.innerHeight || document.documentElement.clientHeight;
      if (rect.top >= 0 && rect.bottom <= viewHeight) {
        return;
      }
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  private clearSuccessTimer(): void {
    if (this.successTimer !== null) {
      clearTimeout(this.successTimer);
      this.successTimer = null;
    }
  }

  private applyDoctor(doctor: AdminDoctorDetail): void {
    this.revokePreviewUrl();
    this.pendingImageFile = null;
    this.firstName = doctor.firstName;
    this.lastName = doctor.lastName;
    this.specialtyId = doctor.specialty.id;
    this.imageUrl = doctor.imageUrl ?? '';
    this.biography = doctor.biography ?? '';
    this.education = doctor.education ?? '';
    this.professionalExperience = doctor.professionalExperience ?? '';
    this.locationIds = doctor.locations.map((location) => location.id);
    this.serviceIds = doctor.services.map((service) => service.id);
    this.days = WEEKDAYS.map((weekday) => {
      const existing = doctor.schedules.find((schedule) => schedule.dayOfWeek === weekday.dayOfWeek);
      return {
        dayOfWeek: weekday.dayOfWeek,
        label: weekday.label,
        works: !!existing,
        startTime: existing?.startTime || '08:00',
        endTime: existing?.endTime || '14:00',
        locationId: existing?.locationId ?? null
      };
    });
    this.imageFailed = false;
    this.snapshot = this.serialize();
  }

  private applySpecialty(nextId: number, services: ClinicService[]): void {
    this.specialtyId = nextId;
    this.specialtyServices = services;
    const allowed = new Set(services.map((service) => service.id));
    this.serviceIds = this.serviceIds.filter((serviceId) => allowed.has(serviceId));
  }

  private isDirty(): boolean {
    return this.serialize() !== this.snapshot || this.pendingImageFile !== null;
  }

  private revokePreviewUrl(): void {
    if (this.previewObjectUrl) {
      URL.revokeObjectURL(this.previewObjectUrl);
      this.previewObjectUrl = '';
    }
  }

  private serialize(): string {
    return JSON.stringify(this.buildPayload());
  }

  private buildPayload(): AdminDoctorUpdatePayload {
    const schedules: AdminDoctorSchedule[] = this.days
      .filter((day) => day.works)
      .map((day) => ({
        dayOfWeek: day.dayOfWeek,
        locationId: day.locationId,
        startTime: day.startTime,
        endTime: day.endTime,
        works: true
      }));

    return {
      firstName: this.firstName.trim(),
      lastName: this.lastName.trim(),
      specialtyId: this.specialtyId,
      imageUrl: this.isCreate ? null : this.imageUrl.trim() || null,
      biography: this.biography.trim() || null,
      education: this.education.trim() || null,
      professionalExperience: this.professionalExperience.trim() || null,
      locationIds: [...this.locationIds],
      serviceIds: [...this.serviceIds],
      schedules
    };
  }
}
