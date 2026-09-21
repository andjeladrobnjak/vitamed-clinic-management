import { ClinicService } from '../services/clinic-service.service';
import { Doctor, DoctorDetail, Specialty } from '../services/doctor.service';

export const BOOKING_HORIZON_DAYS = 60;
export const WEEKDAY_LABELS = ['Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub', 'Ned'];

export const SPECIALTY_ORDER = [
  'Kardiologija',
  'Pulmologija',
  'Endokrinologija',
  'Ginekologija',
  'Pedijatrija',
  'Oftalmologija',
  'Otorinolaringologija (ORL)',
  'Hirurgija'
];

export interface BookingDoctor {
  id: number;
  firstName: string;
  lastName: string;
  imageUrl: string | null;
  specialty: Specialty;
  locationIds: number[];
  serviceIds: number[];
}

export function toBookingDoctor(doctor: Doctor | DoctorDetail): BookingDoctor {
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

export function collectSpecialties(services: ClinicService[]): Specialty[] {
  const byId = new Map<number, Specialty>();
  for (const service of services) {
    byId.set(service.specialty.id, service.specialty);
  }

  return [...byId.values()].sort((a, b) => specialtyRank(a.name) - specialtyRank(b.name));
}

export function sortClinicServices(services: ClinicService[]): ClinicService[] {
  return [...services].sort((a, b) => {
    const rank = specialtyRank(a.specialty.name) - specialtyRank(b.specialty.name);
    if (rank !== 0) {
      return rank;
    }
    return a.name.localeCompare(b.name, 'sr');
  });
}

export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDaysIso(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return toDateInputValue(new Date(year, month - 1, day + days));
}

export function formatPrice(price: number): string {
  return `${new Intl.NumberFormat('sr-RS', { maximumFractionDigits: 0 }).format(price)} RSD`;
}

export function formatDuration(minutes: number): string {
  return `${minutes} min`;
}

export function formatNationalNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 9);
  const parts = [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 9)];
  return parts.filter(Boolean).join(' ');
}

export function toFormPhone(phone: string): string {
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

  const nationalNumber = formatNationalNumber(digits);
  return nationalNumber ? `+381 ${nationalNumber}` : '';
}

function specialtyRank(name: string): number {
  const index = SPECIALTY_ORDER.indexOf(name);
  return index === -1 ? 99 : index;
}
