import { RowDataPacket } from 'mysql2';
import pool from '../db/connection';
import { ISO_DATE_PATTERN } from '../availability/availability.constants';
import {
    addCalendarDays,
    isIsoDate,
    parsePositiveId,
    weekdayFromCalendarDate
} from '../availability/availability.logic';
import { AdminPortalError } from './admin-portal.service';
import {
    displayLocationId,
    mapAbsenceReason,
    resolveEffectiveSchedule,
    ScheduleAbsenceReason,
    ScheduleShift
} from '../schedule/effective-schedule';

export type AdminWeeklyAbsenceReason = ScheduleAbsenceReason;

export interface AdminWeeklyScheduleEntry {
    doctorId: number;
    firstName: string;
    lastName: string;
    specialtyName: string;
    startTime: string;
    endTime: string;
    absenceReason: AdminWeeklyAbsenceReason | null;
    isException: boolean;
}

export interface AdminWeeklyScheduleDay {
    date: string;
    dayOfWeek: number;
    entries: AdminWeeklyScheduleEntry[];
}

export interface AdminWeeklySchedule {
    location: { id: number; name: string };
    weekStart: string;
    weekEnd: string;
    days: AdminWeeklyScheduleDay[];
}

interface LocationRow extends RowDataPacket {
    id: number;
    name: string;
}

interface ShiftRow extends RowDataPacket {
    doctorId: number;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    locationId: number;
    locationName: string;
    firstName: string;
    lastName: string;
    specialtyName: string;
}

interface ExceptionRow extends RowDataPacket {
    doctorId: number;
    exceptionDate: string;
    startTime: string;
    endTime: string;
    locationId: number;
    locationName: string;
    firstName: string;
    lastName: string;
    specialtyName: string;
}

interface AbsenceRow extends RowDataPacket {
    doctorId: number;
    startDate: string;
    endDate: string;
    reason: string;
}

interface DoctorInfo {
    firstName: string;
    lastName: string;
    specialtyName: string;
}

export class AdminWeeklyScheduleService {
    async getWeek(query: Record<string, unknown>): Promise<AdminWeeklySchedule> {
        const locationId = parsePositiveId(query['locationId']);
        if (!locationId) {
            throw new AdminPortalError(400, 'Lokacija nije ispravna.');
        }

        const weekStartRaw = String(query['weekStart'] ?? '').trim();
        if (!ISO_DATE_PATTERN.test(weekStartRaw) || !isIsoDate(weekStartRaw)) {
            throw new AdminPortalError(400, 'Nedelja nije ispravna.');
        }

        const weekStart = addCalendarDays(weekStartRaw, -(weekdayFromCalendarDate(weekStartRaw) - 1));
        const weekEnd = addCalendarDays(weekStart, 6);

        const [locationRows] = await pool.query<LocationRow[]>(
            'SELECT id, name FROM locations WHERE id = ? LIMIT 1',
            [locationId]
        );
        const location = locationRows[0];
        if (!location) {
            throw new AdminPortalError(404, 'Lokacija nije pronađena.');
        }

        const [shiftRows] = await pool.query<ShiftRow[]>(
            `SELECT
                ds.doctor_id AS doctorId,
                ds.day_of_week AS dayOfWeek,
                TIME_FORMAT(ds.start_time, '%H:%i') AS startTime,
                TIME_FORMAT(ds.end_time, '%H:%i') AS endTime,
                ds.location_id AS locationId,
                l.name AS locationName,
                d.first_name AS firstName,
                d.last_name AS lastName,
                s.name AS specialtyName
             FROM doctor_schedules ds
             INNER JOIN doctors d ON d.id = ds.doctor_id
             INNER JOIN specialties s ON s.id = d.specialty_id
             INNER JOIN locations l ON l.id = ds.location_id
             ORDER BY ds.start_time ASC, d.last_name ASC, d.first_name ASC, d.id ASC`
        );

        const [exceptionRows] = await pool.query<ExceptionRow[]>(
            `SELECT
                e.doctor_id AS doctorId,
                DATE_FORMAT(e.exception_date, '%Y-%m-%d') AS exceptionDate,
                TIME_FORMAT(e.start_time, '%H:%i') AS startTime,
                TIME_FORMAT(e.end_time, '%H:%i') AS endTime,
                e.location_id AS locationId,
                l.name AS locationName,
                d.first_name AS firstName,
                d.last_name AS lastName,
                s.name AS specialtyName
             FROM doctor_schedule_exceptions e
             INNER JOIN doctors d ON d.id = e.doctor_id
             INNER JOIN specialties s ON s.id = d.specialty_id
             INNER JOIN locations l ON l.id = e.location_id
             WHERE e.exception_date BETWEEN ? AND ?
             ORDER BY e.start_time ASC, d.last_name ASC, d.first_name ASC, d.id ASC`,
            [weekStart, weekEnd]
        );

        const doctors = new Map<number, DoctorInfo>();
        const regularByDoctor = new Map<number, Map<number, ScheduleShift>>();
        const exceptionsByDoctor = new Map<number, Map<string, ScheduleShift>>();

        for (const row of shiftRows) {
            const doctorId = Number(row.doctorId);
            doctors.set(doctorId, this.mapDoctor(row));
            const byWeekday = regularByDoctor.get(doctorId) ?? new Map<number, ScheduleShift>();
            byWeekday.set(Number(row.dayOfWeek), this.mapShift(row));
            regularByDoctor.set(doctorId, byWeekday);
        }

        for (const row of exceptionRows) {
            const doctorId = Number(row.doctorId);
            doctors.set(doctorId, this.mapDoctor(row));
            const byDate = exceptionsByDoctor.get(doctorId) ?? new Map<string, ScheduleShift>();
            byDate.set(String(row.exceptionDate), this.mapShift(row));
            exceptionsByDoctor.set(doctorId, byDate);
        }

        const absencesByDoctor = new Map<number, { startDate: string; endDate: string; reason: AdminWeeklyAbsenceReason }[]>();
        const doctorIds = [...doctors.keys()];
        if (doctorIds.length > 0) {
            const placeholders = doctorIds.map(() => '?').join(', ');
            const [absenceRows] = await pool.query<AbsenceRow[]>(
                `SELECT
                    doctor_id AS doctorId,
                    DATE_FORMAT(start_date, '%Y-%m-%d') AS startDate,
                    DATE_FORMAT(end_date, '%Y-%m-%d') AS endDate,
                    reason
                 FROM doctor_absences
                 WHERE doctor_id IN (${placeholders})
                   AND start_date <= ?
                   AND end_date >= ?
                 ORDER BY start_date ASC, end_date ASC, id ASC`,
                [...doctorIds, weekEnd, weekStart]
            );

            for (const row of absenceRows) {
                const doctorId = Number(row.doctorId);
                const list = absencesByDoctor.get(doctorId) ?? [];
                list.push({
                    startDate: String(row.startDate),
                    endDate: String(row.endDate),
                    reason: mapAbsenceReason(String(row.reason))
                });
                absencesByDoctor.set(doctorId, list);
            }
        }

        const days: AdminWeeklyScheduleDay[] = [];
        for (let offset = 0; offset < 7; offset += 1) {
            const date = addCalendarDays(weekStart, offset);
            const dayOfWeek = offset + 1;
            const entries: AdminWeeklyScheduleEntry[] = [];

            for (const [doctorId, info] of doctors) {
                const absence = (absencesByDoctor.get(doctorId) ?? []).find(
                    (item) => item.startDate <= date && item.endDate >= date
                );
                const resolved = resolveEffectiveSchedule({
                    date,
                    weekday: dayOfWeek,
                    absent: Boolean(absence),
                    absenceReason: absence?.reason ?? null,
                    regular: regularByDoctor.get(doctorId)?.get(dayOfWeek) ?? null,
                    exception: exceptionsByDoctor.get(doctorId)?.get(date) ?? null
                });

                if (displayLocationId(resolved) !== locationId) {
                    continue;
                }

                const shown = resolved.effective ?? resolved.exception ?? resolved.regular;
                if (!shown) {
                    continue;
                }

                entries.push({
                    doctorId,
                    firstName: info.firstName,
                    lastName: info.lastName,
                    specialtyName: info.specialtyName,
                    startTime: shown.startTime,
                    endTime: shown.endTime,
                    absenceReason: resolved.absenceReason,
                    isException: !resolved.absent && resolved.effective?.source === 'exception'
                });
            }

            entries.sort((a, b) => {
                if (a.startTime !== b.startTime) {
                    return a.startTime < b.startTime ? -1 : 1;
                }
                const last = a.lastName.localeCompare(b.lastName, 'sr');
                if (last !== 0) {
                    return last;
                }
                return a.firstName.localeCompare(b.firstName, 'sr') || a.doctorId - b.doctorId;
            });

            days.push({ date, dayOfWeek, entries });
        }

        return {
            location: {
                id: Number(location.id),
                name: String(location.name)
            },
            weekStart,
            weekEnd,
            days
        };
    }

    private mapDoctor(row: { firstName: string; lastName: string; specialtyName: string }): DoctorInfo {
        return {
            firstName: String(row.firstName),
            lastName: String(row.lastName),
            specialtyName: String(row.specialtyName)
        };
    }

    private mapShift(row: { startTime: string; endTime: string; locationId: number; locationName: string }): ScheduleShift {
        return {
            startTime: String(row.startTime),
            endTime: String(row.endTime),
            location: {
                id: Number(row.locationId),
                name: String(row.locationName)
            }
        };
    }
}
