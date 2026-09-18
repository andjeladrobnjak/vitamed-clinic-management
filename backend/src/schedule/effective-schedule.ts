export type ScheduleAbsenceReason = 'annual_leave' | 'sick_leave' | 'day_off' | 'other';

export interface ScheduleLocation {
    id: number;
    name: string;
}

export interface ScheduleShift {
    startTime: string;
    endTime: string;
    location: ScheduleLocation;
}

export type EffectiveShiftSource = 'regular' | 'exception';

export interface EffectiveShift extends ScheduleShift {
    source: EffectiveShiftSource;
}

export interface EffectiveScheduleResolution {
    date: string;
    weekday: number;
    absent: boolean;
    absenceReason: ScheduleAbsenceReason | null;
    regular: ScheduleShift | null;
    exception: ScheduleShift | null;
    effective: EffectiveShift | null;
}

export interface BookingExceptionShift {
    locationId: number;
    startMinutes: number;
    endMinutes: number;
}

export interface BookingRegularShift {
    dayOfWeek: number;
    startMinutes: number;
    endMinutes: number;
}

export function mapAbsenceReason(reason: string): ScheduleAbsenceReason {
    if (reason === 'annual_leave' || reason === 'sick_leave' || reason === 'day_off') {
        return reason;
    }
    return 'other';
}

export function resolveEffectiveSchedule(input: {
    date: string;
    weekday: number;
    absent: boolean;
    absenceReason?: ScheduleAbsenceReason | null;
    regular: ScheduleShift | null;
    exception: ScheduleShift | null;
}): EffectiveScheduleResolution {
    const absent = input.absent;
    const absenceReason = absent ? (input.absenceReason ?? 'other') : null;
    let effective: EffectiveShift | null = null;

    if (!absent) {
        if (input.exception) {
            effective = { ...input.exception, source: 'exception' };
        } else if (input.regular) {
            effective = { ...input.regular, source: 'regular' };
        }
    }

    return {
        date: input.date,
        weekday: input.weekday,
        absent,
        absenceReason,
        regular: input.regular,
        exception: input.exception,
        effective
    };
}

export function displayLocationId(resolution: EffectiveScheduleResolution): number | null {
    if (resolution.absent) {
        return resolution.exception?.location.id ?? resolution.regular?.location.id ?? null;
    }
    return resolution.effective?.location.id ?? null;
}

export function bookingShiftForLocation(input: {
    weekday: number;
    locationId: number;
    absent: boolean;
    regular: BookingRegularShift | undefined;
    exception: BookingExceptionShift | undefined;
}): BookingRegularShift | undefined {
    if (input.absent) {
        return undefined;
    }

    if (input.exception) {
        if (input.exception.locationId !== input.locationId) {
            return undefined;
        }
        return {
            dayOfWeek: input.weekday,
            startMinutes: input.exception.startMinutes,
            endMinutes: input.exception.endMinutes
        };
    }

    return input.regular;
}

export function appointmentFitsShift(
    appointment: { startMinutes: number; endMinutes: number; locationId: number },
    shift: { startMinutes: number; endMinutes: number; locationId: number } | null
): 'ok' | 'no-shift' | 'time' | 'location' {
    if (!shift) {
        return 'no-shift';
    }
    if (appointment.locationId !== shift.locationId) {
        return 'location';
    }
    if (appointment.startMinutes < shift.startMinutes || appointment.endMinutes > shift.endMinutes) {
        return 'time';
    }
    return 'ok';
}

export function formatDotDate(isoDate: string): string {
    const [year, month, day] = isoDate.split('-');
    return `${day}.${month}.${year}`;
}
