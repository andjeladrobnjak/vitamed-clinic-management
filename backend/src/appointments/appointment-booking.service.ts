import { ResultSetHeader, RowDataPacket } from 'mysql2';
import type { PoolConnection } from 'mysql2/promise';
import pool from '../db/connection';
import { ISO_DATE_PATTERN } from '../availability/availability.constants';
import {
    clinicClock,
    compareIsoDates,
    isIsoDate,
    normalizeTimeLabel,
    timeToMinutes
} from '../availability/availability.logic';
import { AvailabilityContextError, AvailabilityService, parsePositiveId } from '../availability/availability.service';

interface PatientRow extends RowDataPacket {
    id: number;
    firstName: string;
    lastName: string;
    jmbg: string;
}

interface CreatedAppointmentRow extends RowDataPacket {
    id: number;
    patientId: number | null;
    appointmentDate: string;
    startTime: string;
    endTime: string;
    patientFirstName: string;
    patientEmail: string;
    durationMinutes: number;
    serviceId: number;
    serviceName: string;
    doctorId: number;
    doctorFirstName: string;
    doctorLastName: string;
    locationId: number;
    locationName: string;
    locationAddress: string;
    locationCity: string;
    locationPhone: string;
}

export interface CreateAppointmentInput {
    doctorId: unknown;
    serviceId: unknown;
    locationId: unknown;
    appointmentDate: unknown;
    startTime: unknown;
    firstName?: unknown;
    lastName?: unknown;
    jmbg?: unknown;
    email?: unknown;
    phone?: unknown;
    authenticatedPatientId?: number | null;
}

export interface UpcomingAppointment {
    id: number;
    appointmentDate: string;
    startTime: string;
    endTime: string;
    service: { name: string };
    doctor: {
        firstName: string;
        lastName: string;
        specialty: { name: string };
    };
    location: {
        name: string;
        address: string;
        city: string;
    };
}

export interface AppointmentReviewSummary {
    id: number;
    rating: number;
    comment: string | null;
}

export interface HistoryAppointment extends UpcomingAppointment {
    review: AppointmentReviewSummary | null;
    hasReport: boolean;
}

export interface PatientAppointmentReport {
    service: { name: string };
    doctor: {
        firstName: string;
        lastName: string;
    };
    report: {
        anamnesis: string;
        findings: string;
        diagnosis: string;
        therapyRecommendations: string | null;
    };
}

interface UpcomingAppointmentRow extends RowDataPacket {
    id: number;
    appointmentDate: string;
    startTime: string;
    endTime: string;
    status: string;
    serviceName: string;
    doctorFirstName: string;
    doctorLastName: string;
    specialtyName: string;
    locationName: string;
    locationAddress: string;
    locationCity: string;
    reviewId: number | null;
    reviewRating: number | null;
    reviewComment: string | null;
    reportId: number | null;
}

export interface CreatedAppointment {
    id: number;
    status: 'confirmed';
    appointmentDate: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    email: string;
    registered: boolean;
    patientFirstName: string;
    service: { id: number; name: string };
    doctor: { id: number; firstName: string; lastName: string };
    location: {
        id: number;
        name: string;
        address: string;
        city: string;
        phone: string;
    };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+381 \d{2} \d{3} \d{4}$/;
const JMBG_PATTERN = /^\d{13}$/;

export class AppointmentBookingService {
    constructor(private readonly availabilityService = new AvailabilityService()) {}

    async getUpcoming(patientId: number): Promise<UpcomingAppointment | null> {
        const appointments = await this.listUpcoming(patientId, 1);
        return appointments[0] ?? null;
    }

    async listUpcoming(patientId: number, limit?: number): Promise<UpcomingAppointment[]> {
        const clock = clinicClock();
        const params: Array<string | number> = [
            patientId,
            clock.date,
            clock.date,
            this.minutesToSqlTime(clock.minutes)
        ];

        let sql = `${this.appointmentSummarySelect()}
             WHERE a.patient_id = ?
               AND a.status = 'confirmed'
               AND (
                    a.appointment_date > ?
                    OR (a.appointment_date = ? AND a.start_time > ?)
               )
             ORDER BY a.appointment_date ASC, a.start_time ASC`;

        if (limit !== undefined) {
            sql += ' LIMIT ?';
            params.push(limit);
        }

        const [rows] = await pool.query<UpcomingAppointmentRow[]>(sql, params);
        return rows.map((row) => this.mapUpcoming(row));
    }

    async listHistory(patientId: number): Promise<HistoryAppointment[]> {
        const [rows] = await pool.query<UpcomingAppointmentRow[]>(
            `${this.appointmentHistorySelect()}
             WHERE a.patient_id = ?
               AND a.status = 'completed'
             ORDER BY a.appointment_date DESC, a.start_time DESC`,
            [patientId]
        );

        return rows.map((row) => this.mapHistory(row));
    }

    async getReport(patientId: number, appointmentIdInput: unknown): Promise<PatientAppointmentReport> {
        const appointmentId = parsePositiveId(appointmentIdInput);
        if (!appointmentId) {
            throw new AvailabilityContextError(400, 'Neispravan identifikator pregleda.');
        }

        const [rows] = await pool.query<(RowDataPacket & {
            serviceName: string;
            doctorFirstName: string;
            doctorLastName: string;
            anamnesis: string;
            findings: string;
            diagnosis: string;
            therapyRecommendations: string | null;
        })[]>(
            `SELECT
                s.name AS serviceName,
                d.first_name AS doctorFirstName,
                d.last_name AS doctorLastName,
                r.anamnesis,
                r.findings,
                r.diagnosis,
                r.therapy_recommendations AS therapyRecommendations
             FROM appointments a
             INNER JOIN services s ON s.id = a.service_id
             INNER JOIN doctors d ON d.id = a.doctor_id
             INNER JOIN appointment_reports r ON r.appointment_id = a.id
             WHERE a.id = ?
               AND a.patient_id = ?
             LIMIT 1`,
            [appointmentId, patientId]
        );

        const row = rows[0];
        if (!row) {
            throw new AvailabilityContextError(404, 'Izveštaj nije pronađen.');
        }

        const therapy = row.therapyRecommendations;
        const therapyRecommendations =
            therapy === null || therapy === undefined ? null : String(therapy).trim() || null;

        return {
            service: { name: String(row.serviceName) },
            doctor: {
                firstName: String(row.doctorFirstName),
                lastName: String(row.doctorLastName)
            },
            report: {
                anamnesis: String(row.anamnesis),
                findings: String(row.findings),
                diagnosis: String(row.diagnosis),
                therapyRecommendations
            }
        };
    }

    async cancel(patientId: number, appointmentId: number): Promise<void> {
        const [rows] = await pool.query<UpcomingAppointmentRow[]>(
            `SELECT
                a.id,
                DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointmentDate,
                TIME_FORMAT(a.start_time, '%H:%i') AS startTime,
                TIME_FORMAT(a.end_time, '%H:%i') AS endTime,
                a.status AS status,
                s.name AS serviceName,
                d.first_name AS doctorFirstName,
                d.last_name AS doctorLastName,
                sp.name AS specialtyName,
                l.name AS locationName,
                l.address AS locationAddress,
                l.city AS locationCity
             FROM appointments a
             INNER JOIN services s ON s.id = a.service_id
             INNER JOIN doctors d ON d.id = a.doctor_id
             INNER JOIN specialties sp ON sp.id = d.specialty_id
             INNER JOIN locations l ON l.id = a.location_id
             WHERE a.id = ?
               AND a.patient_id = ?
             LIMIT 1`,
            [appointmentId, patientId]
        );

        const row = rows[0];
        if (!row) {
            throw new AvailabilityContextError(404, 'Zakazani pregled nije pronađen.');
        }

        if (String(row.status) !== 'confirmed') {
            throw new AvailabilityContextError(409, 'Ovaj pregled nije moguće otkazati.');
        }

        if (!this.isStartInFuture(String(row.appointmentDate), String(row.startTime))) {
            throw new AvailabilityContextError(409, 'Termin koji je već počeo nije moguće otkazati.');
        }

        const [result] = await pool.query<ResultSetHeader>(
            `UPDATE appointments
             SET status = 'cancelled'
             WHERE id = ?
               AND patient_id = ?
               AND status = 'confirmed'`,
            [appointmentId, patientId]
        );

        if (result.affectedRows !== 1) {
            throw new AvailabilityContextError(409, 'Ovaj pregled nije moguće otkazati.');
        }
    }

    async create(input: CreateAppointmentInput): Promise<CreatedAppointment> {
        const doctorId = parsePositiveId(input.doctorId);
        const serviceId = parsePositiveId(input.serviceId);
        const locationId = parsePositiveId(input.locationId);
        const appointmentDate = typeof input.appointmentDate === 'string' ? input.appointmentDate : '';
        const startTime = normalizeTimeLabel(typeof input.startTime === 'string' ? input.startTime : '');

        if (
            !doctorId ||
            !serviceId ||
            !locationId ||
            !ISO_DATE_PATTERN.test(appointmentDate) ||
            !isIsoDate(appointmentDate) ||
            !startTime
        ) {
            throw new AvailabilityContextError(
                400,
                'Potrebni su ispravni doctorId, serviceId, locationId, appointmentDate i startTime.'
            );
        }

        const snapshot = await this.resolvePatientSnapshot(input);
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            const slot = await this.availabilityService.assertRequestedStartIsAvailable(connection, {
                doctorId,
                serviceId,
                locationId,
                date: appointmentDate,
                startTime
            });

            const [insertResult] = await connection.query<ResultSetHeader>(
                `INSERT INTO appointments (
                    patient_id,
                    doctor_id,
                    service_id,
                    location_id,
                    appointment_date,
                    start_time,
                    end_time,
                    patient_first_name,
                    patient_last_name,
                    patient_jmbg,
                    patient_email,
                    patient_phone,
                    status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')`,
                [
                    snapshot.patientId,
                    doctorId,
                    serviceId,
                    locationId,
                    appointmentDate,
                    startTime,
                    slot.endTime,
                    snapshot.firstName,
                    snapshot.lastName,
                    snapshot.jmbg,
                    snapshot.email,
                    snapshot.phone
                ]
            );

            const created = await this.readCreatedAppointment(connection, insertResult.insertId);
            await connection.commit();
            return created;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    private async resolvePatientSnapshot(input: CreateAppointmentInput): Promise<{
        patientId: number | null;
        firstName: string;
        lastName: string;
        jmbg: string;
        email: string;
        phone: string;
    }> {
        const email = this.requiredEmail(input.email);
        const phone = this.requiredPhone(input.phone);

        if (input.authenticatedPatientId) {
            const [rows] = await pool.query<PatientRow[]>(
                `SELECT id, first_name AS firstName, last_name AS lastName, jmbg
                 FROM patients
                 WHERE id = ?
                 LIMIT 1`,
                [input.authenticatedPatientId]
            );

            const patient = rows[0];
            if (!patient) {
                throw new AvailabilityContextError(401, 'Niste prijavljeni.');
            }

            return {
                patientId: Number(patient.id),
                firstName: String(patient.firstName).trim(),
                lastName: String(patient.lastName).trim(),
                jmbg: String(patient.jmbg).trim(),
                email,
                phone
            };
        }

        const firstName = this.requiredName(input.firstName, 'Ime je obavezno.');
        const lastName = this.requiredName(input.lastName, 'Prezime je obavezno.');
        const jmbg = String(input.jmbg ?? '').trim();

        if (!JMBG_PATTERN.test(jmbg)) {
            throw new AvailabilityContextError(400, 'JMBG mora sadržati tačno 13 cifara.');
        }

        return {
            patientId: null,
            firstName,
            lastName,
            jmbg,
            email,
            phone
        };
    }

    private async readCreatedAppointment(connection: PoolConnection, id: number): Promise<CreatedAppointment> {
        const [rows] = await connection.query<CreatedAppointmentRow[]>(
            `SELECT
                a.id,
                a.patient_id AS patientId,
                DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointmentDate,
                TIME_FORMAT(a.start_time, '%H:%i') AS startTime,
                TIME_FORMAT(a.end_time, '%H:%i') AS endTime,
                a.patient_first_name AS patientFirstName,
                a.patient_email AS patientEmail,
                s.duration_minutes AS durationMinutes,
                s.id AS serviceId,
                s.name AS serviceName,
                d.id AS doctorId,
                d.first_name AS doctorFirstName,
                d.last_name AS doctorLastName,
                l.id AS locationId,
                l.name AS locationName,
                l.address AS locationAddress,
                l.city AS locationCity,
                l.phone AS locationPhone
             FROM appointments a
             INNER JOIN services s ON s.id = a.service_id
             INNER JOIN doctors d ON d.id = a.doctor_id
             INNER JOIN locations l ON l.id = a.location_id
             WHERE a.id = ?
             LIMIT 1`,
            [id]
        );

        const row = rows[0];
        if (!row) {
            throw new AvailabilityContextError(500, 'Zakazani pregled nije moguće učitati.');
        }

        return {
            id: Number(row.id),
            status: 'confirmed',
            appointmentDate: String(row.appointmentDate),
            startTime: String(row.startTime),
            endTime: String(row.endTime),
            durationMinutes: Number(row.durationMinutes),
            email: String(row.patientEmail),
            registered: row.patientId !== null,
            patientFirstName: String(row.patientFirstName),
            service: {
                id: Number(row.serviceId),
                name: String(row.serviceName)
            },
            doctor: {
                id: Number(row.doctorId),
                firstName: String(row.doctorFirstName),
                lastName: String(row.doctorLastName)
            },
            location: {
                id: Number(row.locationId),
                name: String(row.locationName),
                address: String(row.locationAddress),
                city: String(row.locationCity),
                phone: String(row.locationPhone)
            }
        };
    }

    private appointmentSummarySelect(): string {
        return `SELECT
                a.id,
                DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointmentDate,
                TIME_FORMAT(a.start_time, '%H:%i') AS startTime,
                TIME_FORMAT(a.end_time, '%H:%i') AS endTime,
                a.status AS status,
                s.name AS serviceName,
                d.first_name AS doctorFirstName,
                d.last_name AS doctorLastName,
                sp.name AS specialtyName,
                l.name AS locationName,
                l.address AS locationAddress,
                l.city AS locationCity
             FROM appointments a
             INNER JOIN services s ON s.id = a.service_id
             INNER JOIN doctors d ON d.id = a.doctor_id
             INNER JOIN specialties sp ON sp.id = d.specialty_id
             INNER JOIN locations l ON l.id = a.location_id`;
    }

    private appointmentHistorySelect(): string {
        return `SELECT
                a.id,
                DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointmentDate,
                TIME_FORMAT(a.start_time, '%H:%i') AS startTime,
                TIME_FORMAT(a.end_time, '%H:%i') AS endTime,
                a.status AS status,
                s.name AS serviceName,
                d.first_name AS doctorFirstName,
                d.last_name AS doctorLastName,
                sp.name AS specialtyName,
                l.name AS locationName,
                l.address AS locationAddress,
                l.city AS locationCity,
                r.id AS reviewId,
                r.rating AS reviewRating,
                r.comment AS reviewComment,
                ar.id AS reportId
             FROM appointments a
             INNER JOIN services s ON s.id = a.service_id
             INNER JOIN doctors d ON d.id = a.doctor_id
             INNER JOIN specialties sp ON sp.id = d.specialty_id
             INNER JOIN locations l ON l.id = a.location_id
             LEFT JOIN doctor_reviews r ON r.appointment_id = a.id
             LEFT JOIN appointment_reports ar ON ar.appointment_id = a.id`;
    }

    private mapHistory(row: UpcomingAppointmentRow): HistoryAppointment {
        return {
            ...this.mapUpcoming(row),
            hasReport: row.reportId !== null && Number(row.reportId) > 0,
            review: row.reviewId
                ? {
                    id: Number(row.reviewId),
                    rating: Number(row.reviewRating),
                    comment: row.reviewComment === null || row.reviewComment === undefined
                        ? null
                        : String(row.reviewComment)
                }
                : null
        };
    }

    private mapUpcoming(row: UpcomingAppointmentRow): UpcomingAppointment {
        return {
            id: Number(row.id),
            appointmentDate: String(row.appointmentDate),
            startTime: String(row.startTime),
            endTime: String(row.endTime),
            service: {
                name: String(row.serviceName)
            },
            doctor: {
                firstName: String(row.doctorFirstName),
                lastName: String(row.doctorLastName),
                specialty: {
                    name: String(row.specialtyName)
                }
            },
            location: {
                name: String(row.locationName),
                address: String(row.locationAddress),
                city: String(row.locationCity)
            }
        };
    }

    private isStartInFuture(appointmentDate: string, startTime: string): boolean {
        const clock = clinicClock();
        const dateOrder = compareIsoDates(appointmentDate, clock.date);
        if (dateOrder > 0) {
            return true;
        }
        if (dateOrder < 0) {
            return false;
        }
        return timeToMinutes(startTime) > clock.minutes;
    }

    private minutesToSqlTime(totalMinutes: number): string {
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
    }

    private requiredName(value: unknown, message: string): string {
        const name = String(value ?? '').trim();
        if (!name) {
            throw new AvailabilityContextError(400, message);
        }
        return name;
    }

    private requiredEmail(value: unknown): string {
        const email = String(value ?? '').trim().toLowerCase();
        if (!EMAIL_PATTERN.test(email)) {
            throw new AvailabilityContextError(400, 'Unesite ispravnu email adresu.');
        }
        return email;
    }

    private requiredPhone(value: unknown): string {
        const phone = String(value ?? '').trim();
        if (!PHONE_PATTERN.test(phone)) {
            throw new AvailabilityContextError(400, 'Unesite ispravan broj telefona.');
        }
        return phone;
    }
}
