import { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import pool from '../db/connection';
import { ISO_DATE_PATTERN } from '../availability/availability.constants';
import {
    clinicClock,
    compareIsoDates,
    isIsoDate,
    normalizeTimeLabel,
    parsePositiveId,
    timeToMinutes,
    weekdayFromCalendarDate
} from '../availability/availability.logic';
import { AdminPortalError } from './admin-portal.service';
import {
    appointmentFitsShift,
    mapAbsenceReason,
    resolveEffectiveSchedule,
    ScheduleAbsenceReason,
    ScheduleShift
} from '../schedule/effective-schedule';

interface IdRow extends RowDataPacket {
    id: number;
}

interface LocationRow extends RowDataPacket {
    id: number;
    name: string;
}

interface ShiftRow extends RowDataPacket {
    startTime: string;
    endTime: string;
    locationId: number;
    locationName: string;
}

interface ExceptionRow extends RowDataPacket {
    id: number;
    doctorId: number;
    exceptionDate: string;
    startTime: string;
    endTime: string;
    locationId: number;
    locationName: string;
}

interface DoctorRow extends RowDataPacket {
    id: number;
    firstName: string;
    lastName: string;
    specialtyName: string;
}

interface AbsenceRow extends RowDataPacket {
    reason: string;
}

interface AppointmentConflictRow extends RowDataPacket {
    startTime: string;
    endTime: string;
    locationId: number;
}

export interface AdminScheduleException {
    id: number;
    doctorId: number;
    date: string;
    startTime: string;
    endTime: string;
    location: { id: number; name: string };
}

export interface AdminScheduleDayDetail {
    doctor: {
        id: number;
        firstName: string;
        lastName: string;
        specialtyName: string;
    };
    date: string;
    weekday: number;
    absent: boolean;
    absenceReason: ScheduleAbsenceReason | null;
    regular: ScheduleShift | null;
    exception: ScheduleShift | null;
    effective: (ScheduleShift & { source: 'regular' | 'exception' }) | null;
    locations: { id: number; name: string }[];
    canEdit: boolean;
    canRestore: boolean;
}

export class AdminScheduleExceptionService {
    async getDay(doctorIdInput: unknown, dateInput: unknown): Promise<AdminScheduleDayDetail> {
        const doctorId = await this.requireDoctorId(doctorIdInput);
        const date = this.readDate(dateInput);
        const weekday = weekdayFromCalendarDate(date);

        const [doctorRows] = await pool.query<DoctorRow[]>(
            `SELECT
                d.id,
                d.first_name AS firstName,
                d.last_name AS lastName,
                s.name AS specialtyName
             FROM doctors d
             INNER JOIN specialties s ON s.id = d.specialty_id
             WHERE d.id = ?
             LIMIT 1`,
            [doctorId]
        );
        const doctor = doctorRows[0];
        if (!doctor) {
            throw new AdminPortalError(404, 'Lekar nije pronađen.');
        }

        const [regular, exception, absenceReason, locations] = await Promise.all([
            this.loadRegular(doctorId, weekday),
            this.loadException(doctorId, date),
            this.loadAbsenceReason(doctorId, date),
            this.loadAssignedLocations(doctorId)
        ]);

        const resolved = resolveEffectiveSchedule({
            date,
            weekday,
            absent: absenceReason !== null,
            absenceReason,
            regular,
            exception
        });
        const today = clinicClock().date;
        const isPast = compareIsoDates(date, today) < 0;

        return {
            doctor: {
                id: Number(doctor.id),
                firstName: String(doctor.firstName),
                lastName: String(doctor.lastName),
                specialtyName: String(doctor.specialtyName)
            },
            date,
            weekday,
            absent: resolved.absent,
            absenceReason: resolved.absenceReason,
            regular: resolved.regular,
            exception: resolved.exception,
            effective: resolved.effective,
            locations,
            canEdit: !resolved.absent && !isPast,
            canRestore: !resolved.absent && !isPast && resolved.exception !== null
        };
    }

    async upsert(
        doctorIdInput: unknown,
        dateInput: unknown,
        body: Record<string, unknown>
    ): Promise<AdminScheduleException> {
        const doctorId = parsePositiveId(doctorIdInput);
        if (!doctorId) {
            throw new AdminPortalError(404, 'Lekar nije pronađen.');
        }

        const date = this.readDate(dateInput);
        const startTime = this.readTime(body['startTime'], 'Unesite vreme početka.');
        const endTime = this.readTime(body['endTime'], 'Unesite vreme završetka.');
        if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
            throw new AdminPortalError(400, 'Vreme početka mora biti pre vremena završetka.');
        }

        const locationId = parsePositiveId(body['locationId']);
        if (!locationId) {
            throw new AdminPortalError(400, 'Lokacija nije ispravna.');
        }

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [doctorRows] = await connection.query<IdRow[]>(
                'SELECT id FROM doctors WHERE id = ? LIMIT 1 FOR UPDATE',
                [doctorId]
            );
            if (!doctorRows[0]) {
                throw new AdminPortalError(404, 'Lekar nije pronađen.');
            }

            this.assertMutableDate(date, endTime);

            const [absenceRows] = await connection.query<AbsenceRow[]>(
                `SELECT reason
                 FROM doctor_absences
                 WHERE doctor_id = ?
                   AND start_date <= ?
                   AND end_date >= ?
                 LIMIT 1
                 FOR UPDATE`,
                [doctorId, date, date]
            );
            if (absenceRows[0]) {
                throw new AdminPortalError(
                    409,
                    'Za izabrani datum je evidentirano odsustvo lekara. Nije moguće dodati posebnu smenu.'
                );
            }

            const [locationRows] = await connection.query<IdRow[]>(
                `SELECT location_id AS id
                 FROM doctor_locations
                 WHERE doctor_id = ? AND location_id = ?
                 LIMIT 1
                 FOR UPDATE`,
                [doctorId, locationId]
            );
            if (!locationRows[0]) {
                throw new AdminPortalError(400, 'Lekar nije dodeljen izabranoj lokaciji.');
            }

            await connection.query(
                'SELECT id FROM doctor_schedule_exceptions WHERE doctor_id = ? AND exception_date = ? FOR UPDATE',
                [doctorId, date]
            );
            await connection.query(
                'SELECT id FROM doctor_schedules WHERE doctor_id = ? AND day_of_week = ? FOR UPDATE',
                [doctorId, weekdayFromCalendarDate(date)]
            );

            await this.assertAppointmentsFit(
                connection,
                doctorId,
                date,
                {
                    startMinutes: timeToMinutes(startTime),
                    endMinutes: timeToMinutes(endTime),
                    locationId
                },
                'save'
            );

            const [existingRows] = await connection.query<ExceptionRow[]>(
                `SELECT
                    id,
                    doctor_id AS doctorId,
                    DATE_FORMAT(exception_date, '%Y-%m-%d') AS exceptionDate,
                    TIME_FORMAT(start_time, '%H:%i') AS startTime,
                    TIME_FORMAT(end_time, '%H:%i') AS endTime,
                    location_id AS locationId,
                    '' AS locationName
                 FROM doctor_schedule_exceptions
                 WHERE doctor_id = ? AND exception_date = ?
                 LIMIT 1`,
                [doctorId, date]
            );

            let exceptionId: number;
            if (existingRows[0]) {
                exceptionId = Number(existingRows[0].id);
                await connection.query(
                    `UPDATE doctor_schedule_exceptions
                     SET start_time = ?, end_time = ?, location_id = ?
                     WHERE id = ? AND doctor_id = ?`,
                    [startTime, endTime, locationId, exceptionId, doctorId]
                );
            } else {
                try {
                    const [insertResult] = await connection.query<ResultSetHeader>(
                        `INSERT INTO doctor_schedule_exceptions
                            (doctor_id, exception_date, start_time, end_time, location_id)
                         VALUES (?, ?, ?, ?, ?)`,
                        [doctorId, date, startTime, endTime, locationId]
                    );
                    exceptionId = Number(insertResult.insertId);
                } catch (error) {
                    if (this.isDuplicate(error)) {
                        throw new AdminPortalError(409, 'Za izabrani datum već postoji posebna smena.');
                    }
                    throw error;
                }
            }

            const [savedRows] = await connection.query<ExceptionRow[]>(
                `SELECT
                    e.id,
                    e.doctor_id AS doctorId,
                    DATE_FORMAT(e.exception_date, '%Y-%m-%d') AS exceptionDate,
                    TIME_FORMAT(e.start_time, '%H:%i') AS startTime,
                    TIME_FORMAT(e.end_time, '%H:%i') AS endTime,
                    e.location_id AS locationId,
                    l.name AS locationName
                 FROM doctor_schedule_exceptions e
                 INNER JOIN locations l ON l.id = e.location_id
                 WHERE e.id = ?
                 LIMIT 1`,
                [exceptionId]
            );

            await connection.commit();
            return this.mapException(savedRows[0]);
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    async remove(doctorIdInput: unknown, dateInput: unknown): Promise<void> {
        const doctorId = await this.requireDoctorId(doctorIdInput);
        const date = this.readDate(dateInput);
        const weekday = weekdayFromCalendarDate(date);

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [exceptionRows] = await connection.query<ExceptionRow[]>(
                `SELECT
                    id,
                    doctor_id AS doctorId,
                    DATE_FORMAT(exception_date, '%Y-%m-%d') AS exceptionDate,
                    TIME_FORMAT(start_time, '%H:%i') AS startTime,
                    TIME_FORMAT(end_time, '%H:%i') AS endTime,
                    location_id AS locationId,
                    '' AS locationName
                 FROM doctor_schedule_exceptions
                 WHERE doctor_id = ? AND exception_date = ?
                 LIMIT 1
                 FOR UPDATE`,
                [doctorId, date]
            );
            if (!exceptionRows[0]) {
                throw new AdminPortalError(404, 'Posebna smena nije pronađena.');
            }

            this.assertMutableDate(date);

            const [regularRows] = await connection.query<ShiftRow[]>(
                `SELECT
                    TIME_FORMAT(ds.start_time, '%H:%i') AS startTime,
                    TIME_FORMAT(ds.end_time, '%H:%i') AS endTime,
                    ds.location_id AS locationId,
                    l.name AS locationName
                 FROM doctor_schedules ds
                 INNER JOIN locations l ON l.id = ds.location_id
                 WHERE ds.doctor_id = ? AND ds.day_of_week = ?
                 LIMIT 1
                 FOR UPDATE`,
                [doctorId, weekday]
            );

            const regular = regularRows[0]
                ? {
                    startMinutes: timeToMinutes(String(regularRows[0].startTime)),
                    endMinutes: timeToMinutes(String(regularRows[0].endTime)),
                    locationId: Number(regularRows[0].locationId)
                }
                : null;

            await this.assertAppointmentsFit(connection, doctorId, date, regular, 'restore');

            await connection.query(
                'DELETE FROM doctor_schedule_exceptions WHERE doctor_id = ? AND exception_date = ?',
                [doctorId, date]
            );
            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    async listEligibleDoctors(
        locationIdInput: unknown,
        dateInput: unknown
    ): Promise<{ doctors: { id: number; firstName: string; lastName: string; specialtyName: string }[] }> {
        const locationId = parsePositiveId(locationIdInput);
        if (!locationId) {
            throw new AdminPortalError(400, 'Lokacija nije ispravna.');
        }
        const date = this.readDate(dateInput);
        this.assertMutableDate(date);
        const weekday = weekdayFromCalendarDate(date);

        const [rows] = await pool.query<DoctorRow[]>(
            `SELECT
                d.id,
                d.first_name AS firstName,
                d.last_name AS lastName,
                s.name AS specialtyName
             FROM doctors d
             INNER JOIN specialties s ON s.id = d.specialty_id
             INNER JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = ?
             WHERE d.is_active = TRUE
             AND NOT EXISTS (
                SELECT 1
                FROM doctor_absences da
                WHERE da.doctor_id = d.id
                  AND da.start_date <= ?
                  AND da.end_date >= ?
             )
             AND NOT EXISTS (
                SELECT 1
                FROM doctor_schedules ds
                WHERE ds.doctor_id = d.id
                  AND ds.day_of_week = ?
             )
             AND NOT EXISTS (
                SELECT 1
                FROM doctor_schedule_exceptions dse
                WHERE dse.doctor_id = d.id
                  AND dse.exception_date = ?
             )
             ORDER BY d.last_name ASC, d.first_name ASC, d.id ASC`,
            [locationId, date, date, weekday, date]
        );

        return {
            doctors: rows.map((row) => ({
                id: Number(row.id),
                firstName: String(row.firstName),
                lastName: String(row.lastName),
                specialtyName: String(row.specialtyName)
            }))
        };
    }

    private async loadRegular(doctorId: number, weekday: number): Promise<ScheduleShift | null> {
        const [rows] = await pool.query<ShiftRow[]>(
            `SELECT
                TIME_FORMAT(ds.start_time, '%H:%i') AS startTime,
                TIME_FORMAT(ds.end_time, '%H:%i') AS endTime,
                ds.location_id AS locationId,
                l.name AS locationName
             FROM doctor_schedules ds
             INNER JOIN locations l ON l.id = ds.location_id
             WHERE ds.doctor_id = ? AND ds.day_of_week = ?
             LIMIT 1`,
            [doctorId, weekday]
        );
        return rows[0] ? this.mapShift(rows[0]) : null;
    }

    private async loadException(doctorId: number, date: string): Promise<ScheduleShift | null> {
        const [rows] = await pool.query<ShiftRow[]>(
            `SELECT
                TIME_FORMAT(e.start_time, '%H:%i') AS startTime,
                TIME_FORMAT(e.end_time, '%H:%i') AS endTime,
                e.location_id AS locationId,
                l.name AS locationName
             FROM doctor_schedule_exceptions e
             INNER JOIN locations l ON l.id = e.location_id
             WHERE e.doctor_id = ? AND e.exception_date = ?
             LIMIT 1`,
            [doctorId, date]
        );
        return rows[0] ? this.mapShift(rows[0]) : null;
    }

    private async loadAbsenceReason(doctorId: number, date: string): Promise<ScheduleAbsenceReason | null> {
        const [rows] = await pool.query<AbsenceRow[]>(
            `SELECT reason
             FROM doctor_absences
             WHERE doctor_id = ?
               AND start_date <= ?
               AND end_date >= ?
             LIMIT 1`,
            [doctorId, date, date]
        );
        return rows[0] ? mapAbsenceReason(String(rows[0].reason)) : null;
    }

    private async loadAssignedLocations(doctorId: number): Promise<{ id: number; name: string }[]> {
        const [rows] = await pool.query<LocationRow[]>(
            `SELECT l.id, l.name
             FROM doctor_locations dl
             INNER JOIN locations l ON l.id = dl.location_id
             WHERE dl.doctor_id = ?
             ORDER BY l.name ASC, l.id ASC`,
            [doctorId]
        );
        return rows.map((row) => ({ id: Number(row.id), name: String(row.name) }));
    }

    private async assertAppointmentsFit(
        connection: PoolConnection,
        doctorId: number,
        date: string,
        shift: { startMinutes: number; endMinutes: number; locationId: number } | null,
        mode: 'save' | 'restore'
    ): Promise<void> {
        const [rows] = await connection.query<AppointmentConflictRow[]>(
            `SELECT
                TIME_FORMAT(start_time, '%H:%i') AS startTime,
                TIME_FORMAT(end_time, '%H:%i') AS endTime,
                location_id AS locationId
             FROM appointments
             WHERE doctor_id = ?
               AND appointment_date = ?
               AND status = 'confirmed'
             ORDER BY start_time ASC
             FOR UPDATE`,
            [doctorId, date]
        );

        let timeConflict = false;
        let locationConflict = false;
        let noShiftConflict = false;

        for (const row of rows) {
            const result = appointmentFitsShift(
                {
                    startMinutes: timeToMinutes(String(row.startTime)),
                    endMinutes: timeToMinutes(String(row.endTime)),
                    locationId: Number(row.locationId)
                },
                shift
            );
            if (result === 'ok') {
                continue;
            }
            if (result === 'location') {
                locationConflict = true;
            } else if (result === 'time') {
                timeConflict = true;
            } else {
                noShiftConflict = true;
            }
        }

        if (!timeConflict && !locationConflict && !noShiftConflict) {
            return;
        }

        if (mode === 'restore') {
            throw new AdminPortalError(
                409,
                'Nije moguće vratiti redovni raspored jer postoje zakazani termini koji zavise od posebne smene.'
            );
        }

        if (locationConflict && !timeConflict && !noShiftConflict) {
            throw new AdminPortalError(
                409,
                'Nije moguće sačuvati posebnu smenu jer postoje zakazani termini na drugoj lokaciji.'
            );
        }

        throw new AdminPortalError(
            409,
            'Nije moguće sačuvati posebnu smenu jer postoje zakazani termini koji ne pripadaju predloženom radnom vremenu.'
        );
    }

    private assertMutableDate(date: string, endTime?: string): void {
        const clock = clinicClock();
        if (compareIsoDates(date, clock.date) < 0) {
            throw new AdminPortalError(400, 'Posebna smena se ne može menjati za datum koji je prošao.');
        }

        if (endTime && compareIsoDates(date, clock.date) === 0 && timeToMinutes(endTime) <= clock.minutes) {
            throw new AdminPortalError(
                400,
                'Nije moguće sačuvati posebnu smenu čije se radno vreme već završilo.'
            );
        }
    }

    private async requireDoctorId(doctorIdInput: unknown): Promise<number> {
        const doctorId = parsePositiveId(doctorIdInput);
        if (!doctorId) {
            throw new AdminPortalError(404, 'Lekar nije pronađen.');
        }
        const [rows] = await pool.query<IdRow[]>('SELECT id FROM doctors WHERE id = ? LIMIT 1', [doctorId]);
        if (!rows[0]) {
            throw new AdminPortalError(404, 'Lekar nije pronađen.');
        }
        return doctorId;
    }

    private readDate(value: unknown): string {
        const date = String(value ?? '').trim();
        if (!ISO_DATE_PATTERN.test(date) || !isIsoDate(date)) {
            throw new AdminPortalError(400, 'Unesite ispravan datum.');
        }
        return date;
    }

    private readTime(value: unknown, missingMessage: string): string {
        if (typeof value !== 'string' || !value.trim()) {
            throw new AdminPortalError(400, missingMessage);
        }
        const label = normalizeTimeLabel(value);
        if (!label) {
            throw new AdminPortalError(400, 'Unesite ispravno radno vreme.');
        }
        const minutes = timeToMinutes(label) % 60;
        if (minutes % 15 !== 0) {
            throw new AdminPortalError(400, 'Unesite ispravno radno vreme.');
        }
        return label;
    }

    private mapShift(row: ShiftRow): ScheduleShift {
        return {
            startTime: String(row.startTime),
            endTime: String(row.endTime),
            location: {
                id: Number(row.locationId),
                name: String(row.locationName)
            }
        };
    }

    private mapException(row: ExceptionRow): AdminScheduleException {
        return {
            id: Number(row.id),
            doctorId: Number(row.doctorId),
            date: String(row.exceptionDate),
            startTime: String(row.startTime),
            endTime: String(row.endTime),
            location: {
                id: Number(row.locationId),
                name: String(row.locationName)
            }
        };
    }

    private isDuplicate(error: unknown): boolean {
        return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY';
    }
}
