import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../db/connection';
import {
    clinicClock,
    compareIsoDates,
    minutesToTimeLabel,
    parsePositiveId,
    timeToMinutes
} from '../availability/availability.logic';
import { dateOfBirthFromJmbg } from '../patients/date-of-birth';

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
    hasReport: boolean;
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

export interface DoctorPortalPatientListItem {
    id: number;
    firstName: string;
    lastName: string;
    dateOfBirth: string | null;
}

export interface DoctorPortalPatientProfile {
    id: number;
    firstName: string;
    lastName: string;
    dateOfBirth: string | null;
    phone: string;
    email: string;
}

export interface DoctorPortalPatientUpcoming {
    id: number;
    date: string;
    startTime: string;
    endTime: string;
    status: 'confirmed';
    service: { name: string };
    location: { name: string };
}

export interface DoctorPortalPatientHistoryItem {
    id: number;
    date: string;
    startTime: string;
    endTime: string;
    status: 'completed';
    isOwnAppointment: boolean;
    hasReport: boolean;
    service: { name: string };
    doctor: { firstName: string; lastName: string };
    location: { name: string };
}

export interface DoctorPortalAppointmentReport {
    patient: {
        id: number;
        firstName: string;
        lastName: string;
        dateOfBirth: string | null;
    };
    appointment: {
        id: number;
        date: string;
        startTime: string;
        endTime: string;
        status: 'completed';
        service: { name: string };
        location: { name: string };
    };
    doctor: {
        id: number;
        firstName: string;
        lastName: string;
        specialty: { name: string };
    };
    report: {
        id: number;
        anamnesis: string;
        findings: string;
        diagnosis: string;
        therapyRecommendations: string | null;
        createdAt: string;
        updatedAt: string;
    };
    isOwnReport: boolean;
}

export interface DoctorPortalPatientDetail {
    patient: DoctorPortalPatientProfile;
    upcomingAppointment: DoctorPortalPatientUpcoming | null;
    history: DoctorPortalPatientHistoryItem[];
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
    reportId: number | null;
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
                l.name AS locationName,
                r.id AS reportId
             FROM appointments a
             INNER JOIN services s ON s.id = a.service_id
             INNER JOIN locations l ON l.id = a.location_id
             LEFT JOIN appointment_reports r ON r.appointment_id = a.id
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

    async listPatients(doctorId: number): Promise<{ patients: DoctorPortalPatientListItem[] }> {
        const [rows] = await pool.query<(RowDataPacket & {
            id: number;
            firstName: string;
            lastName: string;
            jmbg: string;
        })[]>(
            `SELECT
                p.id,
                p.first_name AS firstName,
                p.last_name AS lastName,
                p.jmbg
             FROM patients p
             INNER JOIN appointments a ON a.patient_id = p.id
             WHERE a.doctor_id = ?
             GROUP BY p.id, p.first_name, p.last_name, p.jmbg
             ORDER BY p.last_name ASC, p.first_name ASC, p.id ASC`,
            [doctorId]
        );

        return {
            patients: rows.map((row) => ({
                id: Number(row.id),
                firstName: String(row.firstName),
                lastName: String(row.lastName),
                dateOfBirth: dateOfBirthFromJmbg(row.jmbg)
            }))
        };
    }

    async getPatient(doctorId: number, patientIdInput: unknown): Promise<DoctorPortalPatientDetail> {
        const patientId = parsePositiveId(patientIdInput);
        if (!patientId) {
            throw new DoctorPortalError(400, 'Neispravan identifikator pacijenta.');
        }

        await this.assertPatientAccess(doctorId, patientId);

        const [patientRows] = await pool.query<(RowDataPacket & {
            id: number;
            firstName: string;
            lastName: string;
            jmbg: string;
            phone: string;
            email: string;
        })[]>(
            `SELECT
                id,
                first_name AS firstName,
                last_name AS lastName,
                jmbg,
                phone,
                email
             FROM patients
             WHERE id = ?
             LIMIT 1`,
            [patientId]
        );
        const patient = patientRows[0];
        if (!patient) {
            throw new DoctorPortalError(404, 'Pacijent nije pronađen.');
        }

        const clock = clinicClock();
        const currentTime = minutesToTimeLabel(clock.minutes);
        const [upcomingRows] = await pool.query<(RowDataPacket & {
            id: number;
            appointmentDate: string;
            startTime: string;
            endTime: string;
            serviceName: string;
            locationName: string;
        })[]>(
            `SELECT
                a.id,
                DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointmentDate,
                TIME_FORMAT(a.start_time, '%H:%i') AS startTime,
                TIME_FORMAT(a.end_time, '%H:%i') AS endTime,
                s.name AS serviceName,
                l.name AS locationName
             FROM appointments a
             INNER JOIN services s ON s.id = a.service_id
             INNER JOIN locations l ON l.id = a.location_id
             WHERE a.patient_id = ?
               AND a.doctor_id = ?
               AND a.status = 'confirmed'
               AND (
                    a.appointment_date > ?
                    OR (a.appointment_date = ? AND TIME_FORMAT(a.start_time, '%H:%i') > ?)
               )
             ORDER BY a.appointment_date ASC, a.start_time ASC, a.id ASC
             LIMIT 1`,
            [patientId, doctorId, clock.date, clock.date, currentTime]
        );

        const [historyRows] = await pool.query<(RowDataPacket & {
            id: number;
            appointmentDate: string;
            startTime: string;
            endTime: string;
            doctorId: number;
            reportId: number | null;
            serviceName: string;
            doctorFirstName: string;
            doctorLastName: string;
            locationName: string;
        })[]>(
            `SELECT
                a.id,
                DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointmentDate,
                TIME_FORMAT(a.start_time, '%H:%i') AS startTime,
                TIME_FORMAT(a.end_time, '%H:%i') AS endTime,
                a.doctor_id AS doctorId,
                r.id AS reportId,
                s.name AS serviceName,
                d.first_name AS doctorFirstName,
                d.last_name AS doctorLastName,
                l.name AS locationName
             FROM appointments a
             INNER JOIN services s ON s.id = a.service_id
             INNER JOIN doctors d ON d.id = a.doctor_id
             INNER JOIN locations l ON l.id = a.location_id
             LEFT JOIN appointment_reports r ON r.appointment_id = a.id
             WHERE a.patient_id = ?
               AND a.status = 'completed'
             ORDER BY a.appointment_date DESC, a.start_time DESC, a.id DESC`,
            [patientId]
        );

        const upcoming = upcomingRows[0];
        return {
            patient: {
                id: Number(patient.id),
                firstName: String(patient.firstName),
                lastName: String(patient.lastName),
                dateOfBirth: dateOfBirthFromJmbg(patient.jmbg),
                phone: String(patient.phone),
                email: String(patient.email)
            },
            upcomingAppointment: upcoming
                ? {
                    id: Number(upcoming.id),
                    date: String(upcoming.appointmentDate),
                    startTime: String(upcoming.startTime),
                    endTime: String(upcoming.endTime),
                    status: 'confirmed',
                    service: { name: String(upcoming.serviceName) },
                    location: { name: String(upcoming.locationName) }
                }
                : null,
            history: historyRows.map((row) => ({
                id: Number(row.id),
                date: String(row.appointmentDate),
                startTime: String(row.startTime),
                endTime: String(row.endTime),
                status: 'completed' as const,
                isOwnAppointment: Number(row.doctorId) === doctorId,
                hasReport: row.reportId !== null && Number(row.reportId) > 0,
                service: { name: String(row.serviceName) },
                doctor: {
                    firstName: String(row.doctorFirstName),
                    lastName: String(row.doctorLastName)
                },
                location: { name: String(row.locationName) }
            }))
        };
    }

    async getAppointmentReport(
        doctorId: number,
        patientIdInput: unknown,
        appointmentIdInput: unknown
    ): Promise<DoctorPortalAppointmentReport> {
        const patientId = parsePositiveId(patientIdInput);
        if (!patientId) {
            throw new DoctorPortalError(400, 'Neispravan identifikator pacijenta.');
        }

        const appointmentId = parsePositiveId(appointmentIdInput);
        if (!appointmentId) {
            throw new DoctorPortalError(400, 'Neispravan identifikator pregleda.');
        }

        await this.assertPatientAccess(doctorId, patientId);

        const [rows] = await pool.query<(RowDataPacket & {
            patientId: number;
            patientFirstName: string;
            patientLastName: string;
            jmbg: string;
            appointmentId: number;
            appointmentDoctorId: number;
            appointmentDate: string;
            startTime: string;
            endTime: string;
            serviceName: string;
            locationName: string;
            doctorId: number;
            doctorFirstName: string;
            doctorLastName: string;
            specialtyName: string;
            reportId: number;
            anamnesis: string;
            findings: string;
            diagnosis: string;
            therapyRecommendations: string | null;
            createdAt: string;
            updatedAt: string;
        })[]>(
            `SELECT
                p.id AS patientId,
                p.first_name AS patientFirstName,
                p.last_name AS patientLastName,
                p.jmbg,
                a.id AS appointmentId,
                a.doctor_id AS appointmentDoctorId,
                DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointmentDate,
                TIME_FORMAT(a.start_time, '%H:%i') AS startTime,
                TIME_FORMAT(a.end_time, '%H:%i') AS endTime,
                s.name AS serviceName,
                l.name AS locationName,
                d.id AS doctorId,
                d.first_name AS doctorFirstName,
                d.last_name AS doctorLastName,
                sp.name AS specialtyName,
                r.id AS reportId,
                r.anamnesis,
                r.findings,
                r.diagnosis,
                r.therapy_recommendations AS therapyRecommendations,
                DATE_FORMAT(r.created_at, '%Y-%m-%dT%H:%i:%s') AS createdAt,
                DATE_FORMAT(r.updated_at, '%Y-%m-%dT%H:%i:%s') AS updatedAt
             FROM appointments a
             INNER JOIN patients p ON p.id = a.patient_id
             INNER JOIN services s ON s.id = a.service_id
             INNER JOIN locations l ON l.id = a.location_id
             INNER JOIN doctors d ON d.id = a.doctor_id
             INNER JOIN specialties sp ON sp.id = d.specialty_id
             INNER JOIN appointment_reports r ON r.appointment_id = a.id
             WHERE a.id = ?
               AND a.patient_id = ?
               AND a.status = 'completed'
             LIMIT 1`,
            [appointmentId, patientId]
        );

        const row = rows[0];
        if (!row) {
            throw new DoctorPortalError(404, 'Izveštaj nije pronađen.');
        }

        const authorDoctorId = Number(row.appointmentDoctorId);
        const therapy = row.therapyRecommendations;
        const therapyRecommendations =
            therapy === null || therapy === undefined ? null : String(therapy).trim() || null;

        return {
            patient: {
                id: Number(row.patientId),
                firstName: String(row.patientFirstName),
                lastName: String(row.patientLastName),
                dateOfBirth: dateOfBirthFromJmbg(row.jmbg)
            },
            appointment: {
                id: Number(row.appointmentId),
                date: String(row.appointmentDate),
                startTime: String(row.startTime),
                endTime: String(row.endTime),
                status: 'completed',
                service: { name: String(row.serviceName) },
                location: { name: String(row.locationName) }
            },
            doctor: {
                id: Number(row.doctorId),
                firstName: String(row.doctorFirstName),
                lastName: String(row.doctorLastName),
                specialty: { name: String(row.specialtyName) }
            },
            report: {
                id: Number(row.reportId),
                anamnesis: String(row.anamnesis),
                findings: String(row.findings),
                diagnosis: String(row.diagnosis),
                therapyRecommendations,
                createdAt: String(row.createdAt),
                updatedAt: String(row.updatedAt)
            },
            isOwnReport: authorDoctorId === doctorId
        };
    }

    private async assertPatientAccess(doctorId: number, patientId: number): Promise<void> {
        const [accessRows] = await pool.query<RowDataPacket[]>(
            `SELECT 1 AS allowed
             FROM appointments
             WHERE doctor_id = ?
               AND patient_id = ?
             LIMIT 1`,
            [doctorId, patientId]
        );
        if (!accessRows[0]) {
            throw new DoctorPortalError(404, 'Pacijent nije pronađen.');
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
            hasReport: row.reportId !== null && Number(row.reportId) > 0,
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
