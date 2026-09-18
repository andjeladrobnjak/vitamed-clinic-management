import { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import pool from '../db/connection';
import { BLOCKING_APPOINTMENT_STATUSES } from './availability.constants';
import {
    ClinicClock,
    DoctorShift,
    TimeInterval,
    availableStartLabelsForDate,
    bookingHorizonEnd,
    clinicClock,
    compareIsoDates,
    eachDateInclusive,
    minutesToTimeLabel,
    normalizeTimeLabel,
    parsePositiveId,
    timeToMinutes,
    weekdayFromCalendarDate
} from './availability.logic';
import { bookingShiftForLocation } from '../schedule/effective-schedule';

type Queryable = Pool | PoolConnection;

interface CountRow extends RowDataPacket {
    total: number;
}

interface DurationRow extends RowDataPacket {
    durationMinutes: number;
}

interface ScheduleRow extends RowDataPacket {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
}

interface ExceptionShiftRow extends RowDataPacket {
    exceptionDate: string;
    startTime: string;
    endTime: string;
    locationId: number;
}

interface AppointmentRow extends RowDataPacket {
    appointmentDate: string;
    startTime: string;
    endTime: string;
}

export class AvailabilityContextError extends Error {
    constructor(
        public readonly statusCode: number,
        message: string
    ) {
        super(message);
        this.name = 'AvailabilityContextError';
    }
}

export interface AvailabilityQuery {
    doctorId: number;
    serviceId: number;
    locationId: number;
}

export class AvailabilityService {
    async getAvailableTimes(params: AvailabilityQuery & { date: string }): Promise<{
        date: string;
        doctorId: number;
        locationId: number;
        serviceId: number;
        availableTimes: string[];
    }> {
        const context = await this.loadContext(params, params.date, params.date, pool);
        const clock = clinicClock();
        const weekday = weekdayFromCalendarDate(params.date);
        const shift = bookingShiftForLocation({
            weekday,
            locationId: params.locationId,
            absent: context.absentDates.has(params.date),
            regular: context.shiftsByWeekday.get(weekday),
            exception: context.exceptionsByDate.get(params.date)
        });
        const blocking = context.appointmentsByDate.get(params.date) ?? [];

        return {
            date: params.date,
            doctorId: params.doctorId,
            locationId: params.locationId,
            serviceId: params.serviceId,
            availableTimes: availableStartLabelsForDate({
                shift,
                durationMinutes: context.durationMinutes,
                blocking,
                date: params.date,
                clock
            })
        };
    }

    async getAvailableDates(
        params: AvailabilityQuery & { from: string; to: string }
    ): Promise<{
        from: string;
        to: string;
        availableDates: string[];
    }> {
        const clock = clinicClock();
        const range = this.clampRange(params.from, params.to, clock);

        if (!range) {
            await this.assertEntitiesExist(params, pool);
            await this.assertDoctorRelationships(params, pool);
            return { from: params.from, to: params.to, availableDates: [] };
        }

        const context = await this.loadContext(params, range.from, range.to, pool);

        const availableDates = eachDateInclusive(range.from, range.to).filter((date) => {
            const weekday = weekdayFromCalendarDate(date);
            const shift = bookingShiftForLocation({
                weekday,
                locationId: params.locationId,
                absent: context.absentDates.has(date),
                regular: context.shiftsByWeekday.get(weekday),
                exception: context.exceptionsByDate.get(date)
            });
            const times = availableStartLabelsForDate({
                shift,
                durationMinutes: context.durationMinutes,
                blocking: context.appointmentsByDate.get(date) ?? [],
                date,
                clock
            });
            return times.length > 0;
        });

        return {
            from: range.from,
            to: range.to,
            availableDates
        };
    }

    private clampRange(
        from: string,
        to: string,
        clock: ClinicClock
    ): { from: string; to: string } | null {
        const horizonEnd = bookingHorizonEnd(clock.date);
        const start = compareIsoDates(from, clock.date) < 0 ? clock.date : from;
        const end = compareIsoDates(to, horizonEnd) > 0 ? horizonEnd : to;

        if (compareIsoDates(start, end) > 0) {
            return null;
        }

        return { from: start, to: end };
    }

    async assertRequestedStartIsAvailable(
        executor: Queryable,
        params: AvailabilityQuery & { date: string; startTime: string }
    ): Promise<{ durationMinutes: number; endTime: string }> {
        const startLabel = normalizeTimeLabel(params.startTime);
        if (!startLabel) {
            throw new AvailabilityContextError(400, 'Unesite ispravno vreme pregleda.');
        }

        const weekday = weekdayFromCalendarDate(params.date);
        await executor.query(
            `SELECT id
             FROM doctor_schedule_exceptions
             WHERE doctor_id = ? AND exception_date = ?
             FOR UPDATE`,
            [params.doctorId, params.date]
        );
        await executor.query(
            `SELECT id
             FROM doctor_schedules
             WHERE doctor_id = ? AND day_of_week = ?
             FOR UPDATE`,
            [params.doctorId, weekday]
        );
        await executor.query(
            `SELECT id
             FROM doctor_absences
             WHERE doctor_id = ?
               AND start_date <= ?
               AND end_date >= ?
             FOR UPDATE`,
            [params.doctorId, params.date, params.date]
        );

        const context = await this.loadContext(params, params.date, params.date, executor);
        const clock = clinicClock();
        const shift = bookingShiftForLocation({
            weekday,
            locationId: params.locationId,
            absent: context.absentDates.has(params.date),
            regular: context.shiftsByWeekday.get(weekday),
            exception: context.exceptionsByDate.get(params.date)
        });
        const availableTimes = availableStartLabelsForDate({
            shift,
            durationMinutes: context.durationMinutes,
            blocking: context.appointmentsByDate.get(params.date) ?? [],
            date: params.date,
            clock
        });

        if (!availableTimes.includes(startLabel)) {
            throw new AvailabilityContextError(
                409,
                'Nažalost, izabrani termin više nije dostupan. Molimo izaberite drugi termin.'
            );
        }

        const startMinutes = timeToMinutes(startLabel);
        return {
            durationMinutes: context.durationMinutes,
            endTime: minutesToTimeLabel(startMinutes + context.durationMinutes)
        };
    }

    private async loadContext(
        params: AvailabilityQuery,
        from: string | undefined,
        to: string | undefined,
        executor: Queryable
    ): Promise<{
        durationMinutes: number;
        shiftsByWeekday: Map<number, DoctorShift>;
        appointmentsByDate: Map<string, TimeInterval[]>;
        absentDates: Set<string>;
        exceptionsByDate: Map<string, { locationId: number; startMinutes: number; endMinutes: number }>;
    }> {
        await this.assertEntitiesExist(params, executor);
        await this.assertDoctorRelationships(params, executor);

        const durationMinutes = await this.getServiceDuration(params.serviceId, executor);
        const shiftsByWeekday = await this.getShifts(params.doctorId, params.locationId, executor);
        const appointmentsByDate = await this.getBlockingAppointments(
            params.doctorId,
            from ?? null,
            to ?? null,
            executor
        );
        const absentDates = await this.getAbsenceDates(
            params.doctorId,
            from ?? null,
            to ?? null,
            executor
        );
        const exceptionsByDate = await this.getExceptions(
            params.doctorId,
            from ?? null,
            to ?? null,
            executor
        );

        return { durationMinutes, shiftsByWeekday, appointmentsByDate, absentDates, exceptionsByDate };
    }

    private async assertEntitiesExist(params: AvailabilityQuery, executor: Queryable): Promise<void> {
        const doctorExists = await this.countById(executor, 'doctors', params.doctorId);
        if (!doctorExists) {
            throw new AvailabilityContextError(404, 'Lekar nije pronađen.');
        }

        const serviceExists = await this.countById(executor, 'services', params.serviceId);
        if (!serviceExists) {
            throw new AvailabilityContextError(404, 'Usluga nije pronađena.');
        }

        const locationExists = await this.countById(executor, 'locations', params.locationId);
        if (!locationExists) {
            throw new AvailabilityContextError(404, 'Lokacija nije pronađena.');
        }
    }

    private async assertDoctorRelationships(params: AvailabilityQuery, executor: Queryable): Promise<void> {
        const [serviceRows] = await executor.query<CountRow[]>(
            `SELECT COUNT(*) AS total
             FROM doctor_services
             WHERE doctor_id = ? AND service_id = ?`,
            [params.doctorId, params.serviceId]
        );

        if (Number(serviceRows[0]?.total ?? 0) === 0) {
            throw new AvailabilityContextError(
                400,
                'Izabrani lekar ne obavlja ovu uslugu.'
            );
        }

        const [locationRows] = await executor.query<CountRow[]>(
            `SELECT COUNT(*) AS total
             FROM doctor_locations
             WHERE doctor_id = ? AND location_id = ?`,
            [params.doctorId, params.locationId]
        );

        if (Number(locationRows[0]?.total ?? 0) === 0) {
            throw new AvailabilityContextError(
                400,
                'Izabrani lekar ne radi na ovoj lokaciji.'
            );
        }
    }

    private async getServiceDuration(serviceId: number, executor: Queryable): Promise<number> {
        const [rows] = await executor.query<DurationRow[]>(
            `SELECT duration_minutes AS durationMinutes
             FROM services
             WHERE id = ?`,
            [serviceId]
        );

        const duration = Number(rows[0]?.durationMinutes);
        if (!Number.isFinite(duration) || duration <= 0) {
            throw new AvailabilityContextError(400, 'Usluga nema ispravno trajanje.');
        }

        return duration;
    }

    private async getShifts(
        doctorId: number,
        locationId: number,
        executor: Queryable
    ): Promise<Map<number, DoctorShift>> {
        const [rows] = await executor.query<ScheduleRow[]>(
            `SELECT
                day_of_week AS dayOfWeek,
                TIME_FORMAT(start_time, '%H:%i:%s') AS startTime,
                TIME_FORMAT(end_time, '%H:%i:%s') AS endTime
             FROM doctor_schedules
             WHERE doctor_id = ? AND location_id = ?`,
            [doctorId, locationId]
        );

        const shifts = new Map<number, DoctorShift>();
        for (const row of rows) {
            shifts.set(Number(row.dayOfWeek), {
                dayOfWeek: Number(row.dayOfWeek),
                startMinutes: timeToMinutes(row.startTime),
                endMinutes: timeToMinutes(row.endTime)
            });
        }
        return shifts;
    }

    private async getBlockingAppointments(
        doctorId: number,
        from: string | null,
        to: string | null,
        executor: Queryable
    ): Promise<Map<string, TimeInterval[]>> {
        const params: Array<number | string> = [doctorId, ...BLOCKING_APPOINTMENT_STATUSES];
        let sql = `
            SELECT
                DATE_FORMAT(appointment_date, '%Y-%m-%d') AS appointmentDate,
                TIME_FORMAT(start_time, '%H:%i:%s') AS startTime,
                TIME_FORMAT(end_time, '%H:%i:%s') AS endTime
            FROM appointments
            WHERE doctor_id = ?
              AND status IN (?, ?)
        `;

        if (from && to) {
            sql += ' AND appointment_date BETWEEN ? AND ?';
            params.push(from, to);
        }

        const [rows] = await executor.query<AppointmentRow[]>(sql, params);
        const byDate = new Map<string, TimeInterval[]>();

        for (const row of rows) {
            const date = String(row.appointmentDate);
            const list = byDate.get(date) ?? [];
            list.push({
                startMinutes: timeToMinutes(row.startTime),
                endMinutes: timeToMinutes(row.endTime)
            });
            byDate.set(date, list);
        }

        return byDate;
    }

    private async getExceptions(
        doctorId: number,
        from: string | null,
        to: string | null,
        executor: Queryable
    ): Promise<Map<string, { locationId: number; startMinutes: number; endMinutes: number }>> {
        const params: Array<number | string> = [doctorId];
        let sql = `
            SELECT
                DATE_FORMAT(exception_date, '%Y-%m-%d') AS exceptionDate,
                TIME_FORMAT(start_time, '%H:%i:%s') AS startTime,
                TIME_FORMAT(end_time, '%H:%i:%s') AS endTime,
                location_id AS locationId
            FROM doctor_schedule_exceptions
            WHERE doctor_id = ?
        `;

        if (from && to) {
            sql += ' AND exception_date BETWEEN ? AND ?';
            params.push(from, to);
        }

        const [rows] = await executor.query<ExceptionShiftRow[]>(sql, params);
        const byDate = new Map<string, { locationId: number; startMinutes: number; endMinutes: number }>();
        for (const row of rows) {
            byDate.set(String(row.exceptionDate), {
                locationId: Number(row.locationId),
                startMinutes: timeToMinutes(row.startTime),
                endMinutes: timeToMinutes(row.endTime)
            });
        }
        return byDate;
    }

    private async getAbsenceDates(
        doctorId: number,
        from: string | null,
        to: string | null,
        executor: Queryable
    ): Promise<Set<string>> {
        const params: Array<number | string> = [doctorId];
        let sql = `
            SELECT
                DATE_FORMAT(start_date, '%Y-%m-%d') AS startDate,
                DATE_FORMAT(end_date, '%Y-%m-%d') AS endDate
            FROM doctor_absences
            WHERE doctor_id = ?
        `;

        if (from && to) {
            sql += ' AND start_date <= ? AND end_date >= ?';
            params.push(to, from);
        }

        const [rows] = await executor.query<(RowDataPacket & { startDate: string; endDate: string })[]>(sql, params);
        const dates = new Set<string>();

        for (const row of rows) {
            const absenceStart = String(row.startDate);
            const absenceEnd = String(row.endDate);
            const rangeStart = from && compareIsoDates(absenceStart, from) < 0 ? from : absenceStart;
            const rangeEnd = to && compareIsoDates(absenceEnd, to) > 0 ? to : absenceEnd;
            if (compareIsoDates(rangeStart, rangeEnd) > 0) {
                continue;
            }
            for (const date of eachDateInclusive(rangeStart, rangeEnd)) {
                dates.add(date);
            }
        }

        return dates;
    }

    private async countById(
        executor: Queryable,
        table: 'doctors' | 'services' | 'locations',
        id: number
    ): Promise<boolean> {
        const [rows] = await executor.query<CountRow[]>(
            `SELECT COUNT(*) AS total FROM ${table} WHERE id = ?`,
            [id]
        );
        return Number(rows[0]?.total ?? 0) > 0;
    }
}

export { parsePositiveId };
