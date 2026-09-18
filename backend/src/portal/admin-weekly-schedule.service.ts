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

export type AdminWeeklyAbsenceReason = 'annual_leave' | 'sick_leave' | 'day_off' | 'other';

export interface AdminWeeklyScheduleEntry {
    doctorId: number;
    firstName: string;
    lastName: string;
    specialtyName: string;
    startTime: string;
    endTime: string;
    absenceReason: AdminWeeklyAbsenceReason | null;
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
                d.first_name AS firstName,
                d.last_name AS lastName,
                s.name AS specialtyName
             FROM doctor_schedules ds
             INNER JOIN doctors d ON d.id = ds.doctor_id
             INNER JOIN specialties s ON s.id = d.specialty_id
             WHERE ds.location_id = ?
             ORDER BY ds.start_time ASC, d.last_name ASC, d.first_name ASC, d.id ASC`,
            [locationId]
        );

        const doctorIds = [...new Set(shiftRows.map((row) => Number(row.doctorId)))];
        const absencesByDoctor = new Map<number, { startDate: string; endDate: string; reason: AdminWeeklyAbsenceReason }[]>();

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
                    reason: this.mapAbsenceReason(String(row.reason))
                });
                absencesByDoctor.set(doctorId, list);
            }
        }

        const days: AdminWeeklyScheduleDay[] = [];
        for (let offset = 0; offset < 7; offset += 1) {
            const date = addCalendarDays(weekStart, offset);
            const dayOfWeek = offset + 1;
            const entries: AdminWeeklyScheduleEntry[] = [];

            for (const row of shiftRows) {
                if (Number(row.dayOfWeek) !== dayOfWeek) {
                    continue;
                }

                const doctorId = Number(row.doctorId);
                const absence = (absencesByDoctor.get(doctorId) ?? []).find(
                    (item) => item.startDate <= date && item.endDate >= date
                );

                entries.push({
                    doctorId,
                    firstName: String(row.firstName),
                    lastName: String(row.lastName),
                    specialtyName: String(row.specialtyName),
                    startTime: String(row.startTime),
                    endTime: String(row.endTime),
                    absenceReason: absence?.reason ?? null
                });
            }

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

    private mapAbsenceReason(reason: string): AdminWeeklyAbsenceReason {
        if (reason === 'annual_leave' || reason === 'sick_leave' || reason === 'day_off') {
            return reason;
        }
        return 'other';
    }
}
