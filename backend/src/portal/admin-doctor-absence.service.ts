import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import pool from '../db/connection';
import {
    clinicClock,
    compareIsoDates,
    isIsoDate,
    parsePositiveId
} from '../availability/availability.logic';
import { AdminPortalError } from './admin-portal.service';

const ABSENCE_REASONS = ['annual_leave', 'sick_leave', 'day_off', 'other'] as const;

type AbsenceReason = (typeof ABSENCE_REASONS)[number];

interface AbsenceRow extends RowDataPacket {
    id: number;
    doctorId: number;
    startDate: string;
    endDate: string;
    reason: string;
    createdAt: Date | string;
}

interface DateRow extends RowDataPacket {
    appointmentDate: string;
}

interface IdRow extends RowDataPacket {
    id: number;
}

export interface AdminDoctorAbsence {
    id: number;
    doctorId: number;
    startDate: string;
    endDate: string;
    reason: AbsenceReason;
    createdAt: string | null;
}

export class AdminDoctorAbsenceService {
    async list(doctorIdInput: unknown): Promise<{ absences: AdminDoctorAbsence[] }> {
        const doctorId = await this.requireDoctorId(doctorIdInput);
        const today = clinicClock().date;
        const [rows] = await pool.query<AbsenceRow[]>(
            `SELECT
                id,
                doctor_id AS doctorId,
                DATE_FORMAT(start_date, '%Y-%m-%d') AS startDate,
                DATE_FORMAT(end_date, '%Y-%m-%d') AS endDate,
                reason,
                created_at AS createdAt
             FROM doctor_absences
             WHERE doctor_id = ?
             ORDER BY
                CASE WHEN end_date < ? THEN 1 ELSE 0 END,
                start_date ASC,
                end_date ASC,
                id ASC`,
            [doctorId, today]
        );

        return { absences: rows.map((row) => this.mapRow(row)) };
    }

    async create(doctorIdInput: unknown, body: Record<string, unknown>): Promise<AdminDoctorAbsence> {
        const doctorId = parsePositiveId(doctorIdInput);
        if (!doctorId) {
            throw new AdminPortalError(404, 'Lekar nije pronađen.');
        }

        const startDate = this.readDate(body['startDate'], 'Datum od je obavezan.');
        const endDate = this.readDate(body['endDate'], 'Datum do je obavezan.');
        if (compareIsoDates(startDate, endDate) > 0) {
            throw new AdminPortalError(400, 'Datum početka ne može biti posle datuma završetka.');
        }

        const reason = this.readReason(body['reason']);
        const today = clinicClock().date;
        if (compareIsoDates(startDate, today) < 0) {
            throw new AdminPortalError(400, 'Odsustvo ne može početi u prošlosti.');
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

            await connection.query('SELECT id FROM doctor_schedules WHERE doctor_id = ? FOR UPDATE', [doctorId]);
            const [overlapRows] = await connection.query<IdRow[]>(
                `SELECT id
                 FROM doctor_absences
                 WHERE doctor_id = ?
                   AND start_date <= ?
                   AND end_date >= ?
                 LIMIT 1
                 FOR UPDATE`,
                [doctorId, endDate, startDate]
            );
            if (overlapRows[0]) {
                throw new AdminPortalError(409, 'Za izabrani period već postoji evidentirano odsustvo.');
            }

            const [conflictRows] = await connection.query<DateRow[]>(
                `SELECT DATE_FORMAT(appointment_date, '%Y-%m-%d') AS appointmentDate
                 FROM appointments
                 WHERE doctor_id = ?
                   AND status = 'confirmed'
                   AND appointment_date BETWEEN ? AND ?
                 ORDER BY appointment_date ASC, start_time ASC
                 FOR UPDATE`,
                [doctorId, startDate, endDate]
            );

            if (conflictRows.length > 0) {
                throw new AdminPortalError(409, this.conflictMessage(conflictRows.map((row) => String(row.appointmentDate))));
            }

            const [insertResult] = await connection.query<ResultSetHeader>(
                `INSERT INTO doctor_absences (doctor_id, start_date, end_date, reason)
                 VALUES (?, ?, ?, ?)`,
                [doctorId, startDate, endDate, reason]
            );

            await connection.commit();

            return {
                id: Number(insertResult.insertId),
                doctorId,
                startDate,
                endDate,
                reason,
                createdAt: new Date().toISOString()
            };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    async remove(doctorIdInput: unknown, absenceIdInput: unknown): Promise<void> {
        const doctorId = await this.requireDoctorId(doctorIdInput);
        const absenceId = parsePositiveId(absenceIdInput);
        if (!absenceId) {
            throw new AdminPortalError(404, 'Odsustvo nije pronađeno.');
        }

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [rows] = await connection.query<AbsenceRow[]>(
                `SELECT
                    id,
                    doctor_id AS doctorId,
                    DATE_FORMAT(start_date, '%Y-%m-%d') AS startDate,
                    DATE_FORMAT(end_date, '%Y-%m-%d') AS endDate,
                    reason,
                    created_at AS createdAt
                 FROM doctor_absences
                 WHERE id = ? AND doctor_id = ?
                 LIMIT 1
                 FOR UPDATE`,
                [absenceId, doctorId]
            );

            const absence = rows[0];
            if (!absence) {
                throw new AdminPortalError(404, 'Odsustvo nije pronađeno.');
            }

            const today = clinicClock().date;
            if (compareIsoDates(String(absence.endDate), today) < 0) {
                throw new AdminPortalError(409, 'Završeno odsustvo nije moguće ukloniti.');
            }

            await connection.query('DELETE FROM doctor_absences WHERE id = ? AND doctor_id = ?', [absenceId, doctorId]);
            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
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

    private readDate(value: unknown, missingMessage: string): string {
        if (typeof value !== 'string' || !value.trim()) {
            throw new AdminPortalError(400, missingMessage);
        }
        const date = value.trim();
        if (!isIsoDate(date)) {
            throw new AdminPortalError(400, 'Unesite ispravan datum.');
        }
        return date;
    }

    private readReason(value: unknown): AbsenceReason {
        if (typeof value !== 'string' || !value.trim()) {
            throw new AdminPortalError(400, 'Razlog odsustva je obavezan.');
        }
        const reason = value.trim();
        if (!ABSENCE_REASONS.includes(reason as AbsenceReason)) {
            throw new AdminPortalError(400, 'Izabrani razlog odsustva nije ispravan.');
        }
        return reason as AbsenceReason;
    }

    private conflictMessage(dates: string[]): string {
        const uniqueDates = [...new Set(dates)];
        const count = dates.length;
        const countLabel = this.pregledLabel(count);
        const dateLabel = uniqueDates.map((date) => this.formatDate(date)).join(', ');
        return `Odsustvo nije moguće dodati jer lekar ima ${count} ${countLabel} u izabranom periodu. Zakazani termini postoje: ${dateLabel}.`;
    }

    private pregledLabel(count: number): string {
        const n = Math.abs(count) % 100;
        const last = n % 10;
        if (n >= 11 && n <= 14) {
            return 'zakazanih pregleda';
        }
        if (last === 1) {
            return 'zakazan pregled';
        }
        if (last >= 2 && last <= 4) {
            return 'zakazana pregleda';
        }
        return 'zakazanih pregleda';
    }

    private formatDate(isoDate: string): string {
        const [year, month, day] = isoDate.split('-');
        return `${day}.${month}.${year}.`;
    }

    private mapRow(row: AbsenceRow): AdminDoctorAbsence {
        const createdAt = row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt ?? '');
        return {
            id: Number(row.id),
            doctorId: Number(row.doctorId),
            startDate: String(row.startDate),
            endDate: String(row.endDate),
            reason: row.reason as AbsenceReason,
            createdAt: createdAt || null
        };
    }
}
