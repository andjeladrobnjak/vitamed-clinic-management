import { RowDataPacket } from 'mysql2';
import pool from '../db/connection';
import { clinicClock, timeToMinutes } from '../availability/availability.logic';

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
