import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../db/connection';
import {
    clinicClock,
    compareIsoDates,
    parsePositiveId,
    timeToMinutes
} from '../availability/availability.logic';

export class DoctorPortalError extends Error {
    constructor(
        public readonly statusCode: number,
        message: string
    ) {
        super(message);
        this.name = 'DoctorPortalError';
    }
}

export interface DoctorDashboardPatient {
    id: number | null;
    firstName: string;
    lastName: string;
}

export interface DoctorDashboardAppointment {
    id: number;
    startTime: string;
    endTime: string;
    status: 'confirmed' | 'completed';
    patient: DoctorDashboardPatient;
    service: { id: number; name: string };
    location: { id: number; name: string };
}

export interface DoctorDashboard {
    today: {
        date: string;
        appointmentCount: number;
        nextAppointment: DoctorDashboardAppointment | null;
        appointments: DoctorDashboardAppointment[];
    };
}

export interface CompletedAppointmentReport {
    id: number;
    appointmentId: number;
    anamnesis: string;
    findings: string;
    diagnosis: string;
    therapyRecommendations: string | null;
}

export interface CompletedAppointment {
    message: string;
    appointment: {
        id: number;
        status: 'completed';
        startTime: string;
        endTime: string;
    };
    report: CompletedAppointmentReport;
}

interface DashboardAppointmentRow extends RowDataPacket {
    id: number;
    startTime: string;
    endTime: string;
    status: string;
    patientId: number | null;
    patientFirstName: string;
    patientLastName: string;
    serviceId: number;
    serviceName: string;
    locationId: number;
    locationName: string;
}

interface CompletionAppointmentRow extends RowDataPacket {
    id: number;
    doctorId: number;
    status: string;
    appointmentDate: string;
    startTime: string;
    endTime: string;
}

interface ReportIdRow extends RowDataPacket {
    id: number;
}

export class DoctorPortalService {
    async getDashboard(doctorId: number): Promise<DoctorDashboard> {
        const clock = clinicClock();
        const [rows] = await pool.query<DashboardAppointmentRow[]>(
            `SELECT
                a.id,
                TIME_FORMAT(a.start_time, '%H:%i') AS startTime,
                TIME_FORMAT(a.end_time, '%H:%i') AS endTime,
                a.status,
                a.patient_id AS patientId,
                a.patient_first_name AS patientFirstName,
                a.patient_last_name AS patientLastName,
                s.id AS serviceId,
                s.name AS serviceName,
                l.id AS locationId,
                l.name AS locationName
             FROM appointments a
             INNER JOIN services s ON s.id = a.service_id
             INNER JOIN locations l ON l.id = a.location_id
             WHERE a.doctor_id = ?
               AND a.appointment_date = ?
               AND a.status IN ('confirmed', 'completed')
             ORDER BY a.start_time ASC, a.id ASC`,
            [doctorId, clock.date]
        );

        const appointments = rows.map((row) => this.mapAppointment(row));
        const nextAppointment =
            appointments.find(
                (appointment) =>
                    appointment.status === 'confirmed' &&
                    timeToMinutes(appointment.startTime) > clock.minutes
            ) ?? null;

        return {
            today: {
                date: clock.date,
                appointmentCount: appointments.length,
                nextAppointment,
                appointments
            }
        };
    }

    async completeAppointment(
        doctorId: number,
        appointmentIdInput: unknown,
        body: {
            anamnesis?: unknown;
            findings?: unknown;
            diagnosis?: unknown;
            therapyRecommendations?: unknown;
        }
    ): Promise<CompletedAppointment> {
        const appointmentId = parsePositiveId(appointmentIdInput);
        if (!appointmentId) {
            throw new DoctorPortalError(400, 'Neispravan identifikator pregleda.');
        }

        const anamnesis = this.requiredReportText(body.anamnesis, 'Anamneza je obavezna.');
        const findings = this.requiredReportText(body.findings, 'Nalaz je obavezan.');
        const diagnosis = this.requiredReportText(body.diagnosis, 'Dijagnoza je obavezna.');
        const therapyRecommendations = this.optionalReportText(body.therapyRecommendations);

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [appointmentRows] = await connection.query<CompletionAppointmentRow[]>(
                `SELECT
                    a.id,
                    a.doctor_id AS doctorId,
                    a.status,
                    DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointmentDate,
                    TIME_FORMAT(a.start_time, '%H:%i') AS startTime,
                    TIME_FORMAT(a.end_time, '%H:%i') AS endTime
                 FROM appointments a
                 WHERE a.id = ?
                 LIMIT 1
                 FOR UPDATE`,
                [appointmentId]
            );

            const appointment = appointmentRows[0];
            if (!appointment || Number(appointment.doctorId) !== doctorId) {
                throw new DoctorPortalError(404, 'Pregled nije pronađen.');
            }

            const status = String(appointment.status);
            if (status === 'cancelled') {
                throw new DoctorPortalError(409, 'Otkazani pregled nije moguće završiti.');
            }
            if (status === 'completed') {
                throw new DoctorPortalError(409, 'Ovaj pregled je već završen.');
            }
            if (status !== 'confirmed') {
                throw new DoctorPortalError(409, 'Ovaj pregled nije moguće završiti.');
            }

            if (!this.hasAppointmentStarted(String(appointment.appointmentDate), String(appointment.startTime))) {
                throw new DoctorPortalError(409, 'Pregled još nije počeo.');
            }

            const [existingReportRows] = await connection.query<ReportIdRow[]>(
                `SELECT id
                 FROM appointment_reports
                 WHERE appointment_id = ?
                 LIMIT 1
                 FOR UPDATE`,
                [appointmentId]
            );
            if (existingReportRows[0]) {
                throw new DoctorPortalError(409, 'Izveštaj za ovaj pregled već postoji.');
            }

            const [insertResult] = await connection.query<ResultSetHeader>(
                `INSERT INTO appointment_reports (
                    appointment_id,
                    anamnesis,
                    findings,
                    diagnosis,
                    therapy_recommendations
                ) VALUES (?, ?, ?, ?, ?)`,
                [appointmentId, anamnesis, findings, diagnosis, therapyRecommendations]
            );

            const [updateResult] = await connection.query<ResultSetHeader>(
                `UPDATE appointments
                 SET status = 'completed'
                 WHERE id = ?
                   AND doctor_id = ?
                   AND status = 'confirmed'`,
                [appointmentId, doctorId]
            );

            if (updateResult.affectedRows !== 1) {
                throw new DoctorPortalError(409, 'Ovaj pregled nije moguće završiti.');
            }

            await connection.commit();

            return {
                message: 'Pregled je uspešno završen.',
                appointment: {
                    id: Number(appointment.id),
                    status: 'completed',
                    startTime: String(appointment.startTime),
                    endTime: String(appointment.endTime)
                },
                report: {
                    id: Number(insertResult.insertId),
                    appointmentId,
                    anamnesis,
                    findings,
                    diagnosis,
                    therapyRecommendations
                }
            };
        } catch (error) {
            await connection.rollback();
            if (this.isDuplicateReport(error)) {
                throw new DoctorPortalError(409, 'Izveštaj za ovaj pregled već postoji.');
            }
            throw error;
        } finally {
            connection.release();
        }
    }

    private hasAppointmentStarted(appointmentDate: string, startTime: string): boolean {
        const clock = clinicClock();
        const dateOrder = compareIsoDates(appointmentDate, clock.date);
        if (dateOrder < 0) {
            return true;
        }
        if (dateOrder > 0) {
            return false;
        }
        return timeToMinutes(startTime) <= clock.minutes;
    }

    private requiredReportText(value: unknown, message: string): string {
        if (typeof value !== 'string') {
            throw new DoctorPortalError(400, message);
        }
        const text = value.trim();
        if (!text) {
            throw new DoctorPortalError(400, message);
        }
        return text;
    }

    private optionalReportText(value: unknown): string | null {
        if (value === undefined || value === null) {
            return null;
        }
        if (typeof value !== 'string') {
            throw new DoctorPortalError(400, 'Terapija i preporuke nisu ispravne.');
        }
        const text = value.trim();
        return text || null;
    }

    private isDuplicateReport(error: unknown): boolean {
        return typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'ER_DUP_ENTRY';
    }

    private mapAppointment(row: DashboardAppointmentRow): DoctorDashboardAppointment {
        const status = String(row.status) === 'completed' ? 'completed' : 'confirmed';

        return {
            id: Number(row.id),
            startTime: String(row.startTime),
            endTime: String(row.endTime),
            status,
            patient: {
                id: row.patientId === null ? null : Number(row.patientId),
                firstName: String(row.patientFirstName),
                lastName: String(row.patientLastName)
            },
            service: {
                id: Number(row.serviceId),
                name: String(row.serviceName)
            },
            location: {
                id: Number(row.locationId),
                name: String(row.locationName)
            }
        };
    }
}
