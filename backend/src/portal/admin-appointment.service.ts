import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import pool from '../db/connection';
import {
    isClinicStartInFuture,
    isIsoDate,
    parsePositiveId
} from '../availability/availability.logic';
import { AdminPortalError } from './admin-portal.service';

const ALLOWED_STATUSES = ['confirmed', 'completed', 'cancelled', 'no_show'] as const;
const DEFAULT_PAGE_SIZE = 15;
const MAX_PAGE_SIZE = 50;

type AppointmentStatus = (typeof ALLOWED_STATUSES)[number];

interface AppointmentRow extends RowDataPacket {
    id: number;
    appointmentDate: string;
    startTime: string;
    endTime: string;
    status: string;
    patientFirstName: string;
    patientLastName: string;
    patientJmbg: string;
    patientEmail: string;
    patientPhone: string;
    doctorId: number;
    doctorFirstName: string;
    doctorLastName: string;
    serviceId: number;
    serviceName: string;
    locationId: number;
    locationName: string;
}

interface CountRow extends RowDataPacket {
    total: number;
}

export interface AdminAppointment {
    id: number;
    appointmentDate: string;
    startTime: string;
    endTime: string;
    status: string;
    patientFirstName: string;
    patientLastName: string;
    patientJmbg: string;
    patientEmail: string;
    patientPhone: string;
    doctor: { id: number; firstName: string; lastName: string };
    service: { id: number; name: string };
    location: { id: number; name: string };
    cancellable: boolean;
}

export interface AdminAppointmentList {
    items: AdminAppointment[];
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
}

export interface AdminCancelledAppointment {
    appointment: AdminAppointment;
    mail: {
        patientEmail: string;
        patientFirstName: string;
        serviceName: string;
        doctorName: string;
        locationName: string;
        locationAddress: string;
        locationCity: string;
        appointmentDate: string;
        startTime: string;
    };
}

export class AdminAppointmentService {
    async list(query: Record<string, unknown>): Promise<AdminAppointmentList> {
        const filters = this.parseFilters(query);
        const { clause, params } = this.buildWhere(filters);
        const orderSql = filters.date
            ? 'ORDER BY a.appointment_date ASC, a.start_time ASC, a.id ASC'
            : 'ORDER BY a.appointment_date DESC, a.start_time DESC, a.id DESC';

        const [countRows] = await pool.query<CountRow[]>(
            `SELECT COUNT(*) AS total
             FROM appointments a
             INNER JOIN doctors d ON d.id = a.doctor_id
             INNER JOIN services s ON s.id = a.service_id
             INNER JOIN locations l ON l.id = a.location_id
             ${clause}`,
            params
        );

        const totalItems = Number(countRows[0]?.total ?? 0);
        const totalPages = Math.max(1, Math.ceil(totalItems / filters.pageSize));
        const page = Math.min(filters.page, totalPages);
        const offset = (page - 1) * filters.pageSize;

        const [rows] = await pool.query<AppointmentRow[]>(
            `${this.selectSql()}
             ${clause}
             ${orderSql}
             LIMIT ${filters.pageSize} OFFSET ${offset}`,
            params
        );

        return {
            items: rows.map((row) => this.mapRow(row)),
            page,
            pageSize: filters.pageSize,
            totalItems,
            totalPages
        };
    }

    async cancel(idInput: unknown): Promise<AdminCancelledAppointment> {
        const id = parsePositiveId(idInput);
        if (!id) {
            throw new AdminPortalError(404, 'Termin nije pronađen.');
        }

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [rows] = await connection.query<(AppointmentRow & {
                locationAddress: string;
                locationCity: string;
            })[]>(
                `SELECT
                    a.id,
                    DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointmentDate,
                    TIME_FORMAT(a.start_time, '%H:%i') AS startTime,
                    TIME_FORMAT(a.end_time, '%H:%i') AS endTime,
                    a.status,
                    a.patient_first_name AS patientFirstName,
                    a.patient_last_name AS patientLastName,
                    a.patient_jmbg AS patientJmbg,
                    a.patient_email AS patientEmail,
                    a.patient_phone AS patientPhone,
                    d.id AS doctorId,
                    d.first_name AS doctorFirstName,
                    d.last_name AS doctorLastName,
                    s.id AS serviceId,
                    s.name AS serviceName,
                    l.id AS locationId,
                    l.name AS locationName,
                    l.address AS locationAddress,
                    l.city AS locationCity
                 FROM appointments a
                 INNER JOIN doctors d ON d.id = a.doctor_id
                 INNER JOIN services s ON s.id = a.service_id
                 INNER JOIN locations l ON l.id = a.location_id
                 WHERE a.id = ?
                 LIMIT 1
                 FOR UPDATE`,
                [id]
            );

            const appointment = rows[0];
            if (!appointment) {
                throw new AdminPortalError(404, 'Termin nije pronađen.');
            }

            const status = String(appointment.status);
            if (status === 'cancelled') {
                throw new AdminPortalError(409, 'Ovaj termin je već otkazan.');
            }
            if (status === 'completed') {
                throw new AdminPortalError(409, 'Završen termin nije moguće otkazati.');
            }
            if (status === 'no_show') {
                throw new AdminPortalError(409, 'Termin na koji se pacijent nije pojavio nije moguće otkazati.');
            }
            if (status !== 'confirmed') {
                throw new AdminPortalError(409, 'Ovaj termin nije moguće otkazati.');
            }

            const appointmentDate = String(appointment.appointmentDate);
            const startTime = String(appointment.startTime);
            if (!isClinicStartInFuture(appointmentDate, startTime)) {
                throw new AdminPortalError(409, 'Termin koji je već počeo nije moguće otkazati.');
            }

            const [updateResult] = await connection.query<ResultSetHeader>(
                `UPDATE appointments
                 SET status = 'cancelled',
                     cancelled_by = 'admin'
                 WHERE id = ?
                   AND status = 'confirmed'`,
                [id]
            );

            if (updateResult.affectedRows !== 1) {
                throw new AdminPortalError(409, 'Ovaj termin nije moguće otkazati.');
            }

            await connection.commit();

            const mapped = this.mapRow({ ...appointment, status: 'cancelled' });
            return {
                appointment: mapped,
                mail: {
                    patientEmail: String(appointment.patientEmail),
                    patientFirstName: String(appointment.patientFirstName),
                    serviceName: String(appointment.serviceName),
                    doctorName: `dr ${appointment.doctorFirstName} ${appointment.doctorLastName}`.trim(),
                    locationName: String(appointment.locationName),
                    locationAddress: String(appointment.locationAddress),
                    locationCity: String(appointment.locationCity),
                    appointmentDate,
                    startTime
                }
            };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    private selectSql(): string {
        return `SELECT
                    a.id,
                    DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointmentDate,
                    TIME_FORMAT(a.start_time, '%H:%i') AS startTime,
                    TIME_FORMAT(a.end_time, '%H:%i') AS endTime,
                    a.status,
                    a.patient_first_name AS patientFirstName,
                    a.patient_last_name AS patientLastName,
                    a.patient_jmbg AS patientJmbg,
                    a.patient_email AS patientEmail,
                    a.patient_phone AS patientPhone,
                    d.id AS doctorId,
                    d.first_name AS doctorFirstName,
                    d.last_name AS doctorLastName,
                    s.id AS serviceId,
                    s.name AS serviceName,
                    l.id AS locationId,
                    l.name AS locationName
                FROM appointments a
                INNER JOIN doctors d ON d.id = a.doctor_id
                INNER JOIN services s ON s.id = a.service_id
                INNER JOIN locations l ON l.id = a.location_id`;
    }

    private parseFilters(query: Record<string, unknown>): {
        search: string;
        date: string | null;
        status: AppointmentStatus | null;
        doctorId: number | null;
        page: number;
        pageSize: number;
    } {
        const search = typeof query['search'] === 'string' ? query['search'].trim() : '';
        if (search.length > 100) {
            throw new AdminPortalError(400, 'Pretraga je predugačka.');
        }

        const dateRaw = typeof query['date'] === 'string' ? query['date'].trim() : '';
        let date: string | null = null;
        if (dateRaw) {
            if (!isIsoDate(dateRaw)) {
                throw new AdminPortalError(400, 'Datum pregleda nije ispravan.');
            }
            date = dateRaw;
        }

        const statusRaw = typeof query['status'] === 'string' ? query['status'].trim() : '';
        let status: AppointmentStatus | null = null;
        if (statusRaw) {
            if (!ALLOWED_STATUSES.includes(statusRaw as AppointmentStatus)) {
                throw new AdminPortalError(400, 'Izabrani status nije ispravan.');
            }
            status = statusRaw as AppointmentStatus;
        }

        const doctorRaw = query['doctorId'];
        let doctorId: number | null = null;
        if (doctorRaw !== undefined && doctorRaw !== null && String(doctorRaw).trim() !== '') {
            doctorId = parsePositiveId(doctorRaw);
            if (!doctorId) {
                throw new AdminPortalError(400, 'Izabrani lekar nije ispravan.');
            }
        }

        const page = Math.max(1, parsePositiveId(query['page']) ?? 1);
        const requestedSize = parsePositiveId(query['pageSize']) ?? DEFAULT_PAGE_SIZE;
        const pageSize = Math.min(MAX_PAGE_SIZE, requestedSize);

        return { search, date, status, doctorId, page, pageSize };
    }

    private buildWhere(filters: {
        search: string;
        date: string | null;
        status: AppointmentStatus | null;
        doctorId: number | null;
    }): { clause: string; params: Array<string | number> } {
        const conditions: string[] = [];
        const params: Array<string | number> = [];

        if (filters.search) {
            const safe = filters.search.replace(/[%_\\]/g, ' ').replace(/\s+/g, ' ').trim();
            if (safe) {
                const pattern = `%${safe.toLowerCase()}%`;
                conditions.push(`(
                    LOWER(a.patient_first_name) LIKE ?
                    OR LOWER(a.patient_last_name) LIKE ?
                    OR LOWER(CONCAT(a.patient_first_name, ' ', a.patient_last_name)) LIKE ?
                )`);
                params.push(pattern, pattern, pattern);
            }
        }

        if (filters.date) {
            conditions.push('a.appointment_date = ?');
            params.push(filters.date);
        }

        if (filters.status) {
            conditions.push('a.status = ?');
            params.push(filters.status);
        }

        if (filters.doctorId) {
            conditions.push('a.doctor_id = ?');
            params.push(filters.doctorId);
        }

        return {
            clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
            params
        };
    }

    private mapRow(row: AppointmentRow): AdminAppointment {
        const appointmentDate = String(row.appointmentDate);
        const startTime = String(row.startTime);
        const status = String(row.status);

        return {
            id: Number(row.id),
            appointmentDate,
            startTime,
            endTime: String(row.endTime),
            status,
            patientFirstName: String(row.patientFirstName),
            patientLastName: String(row.patientLastName),
            patientJmbg: String(row.patientJmbg),
            patientEmail: String(row.patientEmail),
            patientPhone: String(row.patientPhone),
            doctor: {
                id: Number(row.doctorId),
                firstName: String(row.doctorFirstName),
                lastName: String(row.doctorLastName)
            },
            service: {
                id: Number(row.serviceId),
                name: String(row.serviceName)
            },
            location: {
                id: Number(row.locationId),
                name: String(row.locationName)
            },
            cancellable: status === 'confirmed' && isClinicStartInFuture(appointmentDate, startTime)
        };
    }
}
