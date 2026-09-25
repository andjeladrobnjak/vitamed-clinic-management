import {
    BLOCKING_APPOINTMENT_STATUSES,
    BOOKING_HORIZON_DAYS,
    CLINIC_TIMEZONE,
    SAME_DAY_LEAD_MINUTES,
    SLOT_GRID_MINUTES
} from './availability.constants';

export interface TimeInterval {
    startMinutes: number;
    endMinutes: number;
}

export interface DoctorShift {
    dayOfWeek: number;
    startMinutes: number;
    endMinutes: number;
}

export interface ClinicClock {
    date: string;
    minutes: number;
}

export function parsePositiveId(value: unknown): number | null {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        return null;
    }
    return parsed;
}

export function isIsoDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const [year, month, day] = value.split('-').map(Number);
    const utc = Date.UTC(year, month - 1, day);
    const check = new Date(utc);
    return (
        check.getUTCFullYear() === year &&
        check.getUTCMonth() === month - 1 &&
        check.getUTCDate() === day
    );
}

export function addCalendarDays(isoDate: string, days: number): string {
    const [year, month, day] = isoDate.split('-').map(Number);
    const next = new Date(Date.UTC(year, month - 1, day + days));
    return formatUtcDate(next);
}

export function formatUtcDate(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function compareIsoDates(a: string, b: string): number {
    if (a === b) {
        return 0;
    }
    return a < b ? -1 : 1;
}

export function weekdayFromCalendarDate(isoDate: string): number {
    const [year, month, day] = isoDate.split('-').map(Number);
    const utcDay = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay();
    return utcDay === 0 ? 7 : utcDay;
}

export function clinicClock(now = new Date()): ClinicClock {
    const date = new Intl.DateTimeFormat('en-CA', {
        timeZone: CLINIC_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(now);

    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: CLINIC_TIMEZONE,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(now);

    const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
    const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');

    return {
        date,
        minutes: hour * 60 + minute
    };
}

export function bookingHorizonEnd(today: string): string {
    return addCalendarDays(today, BOOKING_HORIZON_DAYS);
}

export function timeToMinutes(value: string): number {
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
}

export function minutesToTimeLabel(totalMinutes: number): string {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function normalizeTimeLabel(value: string): string | null {
    const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
    if (!match) {
        return null;
    }

    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) {
        return null;
    }

    return minutesToTimeLabel(hours * 60 + minutes);
}

export function intervalsOverlap(a: TimeInterval, b: TimeInterval): boolean {
    return a.startMinutes < b.endMinutes && a.endMinutes > b.startMinutes;
}

export function generateShiftStartMinutes(
    shiftStart: number,
    shiftEnd: number,
    durationMinutes: number
): number[] {
    const lastStart = shiftEnd - durationMinutes;
    if (lastStart < shiftStart) {
        return [];
    }

    const starts: number[] = [];
    for (let start = shiftStart; start <= lastStart; start += SLOT_GRID_MINUTES) {
        starts.push(start);
    }
    return starts;
}

export function filterAvailableStartMinutes(
    candidates: number[],
    durationMinutes: number,
    blocking: TimeInterval[],
    date: string,
    clock: ClinicClock
): number[] {
    if (compareIsoDates(date, clock.date) < 0) {
        return [];
    }

    const earliestToday =
        date === clock.date ? clock.minutes + SAME_DAY_LEAD_MINUTES : Number.NEGATIVE_INFINITY;

    return candidates.filter((startMinutes) => {
        if (startMinutes < earliestToday) {
            return false;
        }

        const candidate: TimeInterval = {
            startMinutes,
            endMinutes: startMinutes + durationMinutes
        };

        return !blocking.some((existing) => intervalsOverlap(existing, candidate));
    });
}

export function availableStartLabelsForDate(params: {
    shift: DoctorShift | undefined;
    durationMinutes: number;
    blocking: TimeInterval[];
    date: string;
    clock: ClinicClock;
}): string[] {
    const { shift, durationMinutes, blocking, date, clock } = params;
    if (!shift) {
        return [];
    }

    const candidates = generateShiftStartMinutes(
        shift.startMinutes,
        shift.endMinutes,
        durationMinutes
    );

    return filterAvailableStartMinutes(
        candidates,
        durationMinutes,
        blocking,
        date,
        clock
    ).map(minutesToTimeLabel);
}

export function eachDateInclusive(from: string, to: string): string[] {
    const dates: string[] = [];
    let current = from;
    while (compareIsoDates(current, to) <= 0) {
        dates.push(current);
        current = addCalendarDays(current, 1);
    }
    return dates;
}

export function calendarDayDiff(fromIsoDate: string, toIsoDate: string): number {
    const [fromYear, fromMonth, fromDay] = fromIsoDate.split('-').map(Number);
    const [toYear, toMonth, toDay] = toIsoDate.split('-').map(Number);
    const fromUtc = Date.UTC(fromYear, fromMonth - 1, fromDay);
    const toUtc = Date.UTC(toYear, toMonth - 1, toDay);
    return Math.round((toUtc - fromUtc) / 86_400_000);
}

export function minutesUntilClinicDateTime(
    appointmentDate: string,
    startTime: string,
    now = new Date()
): number {
    const clock = clinicClock(now);
    return calendarDayDiff(clock.date, appointmentDate) * 24 * 60 + timeToMinutes(startTime) - clock.minutes;
}

export function isAtLeastHoursAhead(
    appointmentDate: string,
    startTime: string,
    hours: number,
    now = new Date()
): boolean {
    return minutesUntilClinicDateTime(appointmentDate, startTime, now) >= hours * 60;
}

export function isMoreThanHoursAhead(
    appointmentDate: string,
    startTime: string,
    hours: number,
    now = new Date()
): boolean {
    return minutesUntilClinicDateTime(appointmentDate, startTime, now) > hours * 60;
}

export function isClinicStartInFuture(
    appointmentDate: string,
    startTime: string,
    now = new Date()
): boolean {
    return minutesUntilClinicDateTime(appointmentDate, startTime, now) > 0;
}

export { BLOCKING_APPOINTMENT_STATUSES };
