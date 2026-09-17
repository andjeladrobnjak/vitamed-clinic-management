import { RowDataPacket } from 'mysql2';
import pool from '../db/connection';
import { clinicClock, minutesToTimeLabel } from '../availability/availability.logic';

export class AdminPortalError extends Error {
    constructor(
        public readonly statusCode: number,
        message: string
    ) {
        super(message);
        this.name = 'AdminPortalError';
    }
}

export interface AdminDashboardAppointment {
    id: number;
    startTime: string;
    endTime: string;
    status: string;
    patientName: string;
    doctorName: string;
    serviceName: string;
    locationName: string;
}

export interface AdminDashboard {
    date: string;
    counts: {
        doctors: number;
        patients: number;
        todayAppointments: number;
        upcomingAppointments: number;
    };
    todayAppointments: AdminDashboardAppointment[];
    todayAppointmentTotal: number;
}

interface CountRow extends RowDataPacket {
    total: number;
}

interface AppointmentRow extends RowDataPacket {
    id: number;
    startTime: string;
    endTime: string;
    status: string;
    patientFirstName: string;
    patientLastName: string;
    doctorFirstName: string;
    doctorLastName: string;
    serviceName: string;
    locationName: string;
}

export class AdminPortalService {
    async getDashboard(): Promise<AdminDashboard> {
        const clock = clinicClock();
        const today = clock.date;
        const nowTime = minutesToTimeLabel(clock.minutes);

        const [doctors, patients, todayTotal, upcomingAppointments, appointmentRows] = await Promise.all([
            this.countTable('doctors'),
            this.countTable('patients'),
            this.countTodayAppointments(today),
            this.countUpcomingAppointments(today, nowTime),
            this.listTodayAppointments(today)
        ]);

        return {
            date: today,
            counts: {
                doctors,
                patients,
                todayAppointments: todayTotal,
                upcomingAppointments
            },
            todayAppointments: appointmentRows.map((row) => ({
                id: Number(row.id),
                startTime: String(row.startTime),
                endTime: String(row.endTime),
                status: String(row.status),
                patientName: `${row.patientFirstName} ${row.patientLastName}`.trim(),
                doctorName: `dr ${row.doctorFirstName} ${row.doctorLastName}`.trim(),
                serviceName: String(row.serviceName),
                locationName: String(row.locationName)
            })),
            todayAppointmentTotal: todayTotal
        };
    }

    private async countTable(table: 'doctors' | 'patients'): Promise<number> {
        const [rows] = await pool.query<CountRow[]>(`SELECT COUNT(*) AS total FROM ${table}`);
        return Number(rows[0]?.total ?? 0);
    }

    private async countTodayAppointments(date: string): Promise<number> {
        const [rows] = await pool.query<CountRow[]>(
            `SELECT COUNT(*) AS total
             FROM appointments
             WHERE appointment_date = ?`,
            [date]
        );
        return Number(rows[0]?.total ?? 0);
    }

    private async countUpcomingAppointments(date: string, time: string): Promise<number> {
        const [rows] = await pool.query<CountRow[]>(
            `SELECT COUNT(*) AS total
             FROM appointments
             WHERE status = 'confirmed'
               AND TIMESTAMP(appointment_date, start_time) > TIMESTAMP(?, ?)`,
            [date, time]
        );
        return Number(rows[0]?.total ?? 0);
    }

    private async listTodayAppointments(date: string): Promise<AppointmentRow[]> {
        const [rows] = await pool.query<AppointmentRow[]>(
            `SELECT
                a.id,
                TIME_FORMAT(a.start_time, '%H:%i') AS startTime,
                TIME_FORMAT(a.end_time, '%H:%i') AS endTime,
                a.status,
                a.patient_first_name AS patientFirstName,
                a.patient_last_name AS patientLastName,
                d.first_name AS doctorFirstName,
                d.last_name AS doctorLastName,
                s.name AS serviceName,
                l.name AS locationName
             FROM appointments a
             INNER JOIN doctors d ON d.id = a.doctor_id
             INNER JOIN services s ON s.id = a.service_id
             INNER JOIN locations l ON l.id = a.location_id
             WHERE a.appointment_date = ?
             ORDER BY a.start_time ASC, a.id ASC`,
            [date]
        );
        return rows;
    }
}
