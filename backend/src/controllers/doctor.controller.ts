import { Request, Response } from 'express';
import { RowDataPacket } from 'mysql2';
import pool from '../db/connection';
import { DOCTOR_RATINGS_JOIN, mapDoctorRating } from '../doctors/doctor-ratings';

interface DoctorRow extends RowDataPacket {
    id: number;
    firstName: string;
    lastName: string;
    biography: string | null;
    education: string | null;
    professionalExperience: string | null;
    imageUrl: string | null;
    specialtyId: number;
    specialtyName: string;
    averageRating: number | string | null;
    reviewCount: number | string | null;
}

interface DoctorLocationRow extends RowDataPacket {
    doctorId: number;
    id: number;
    name: string;
}

interface DoctorServiceListRow extends RowDataPacket {
    doctorId: number;
    id: number;
    name: string;
}

interface DoctorDetailLocationRow extends RowDataPacket {
    id: number;
    name: string;
    address: string;
    city: string;
    phone: string;
    workingHours: string;
}

interface DoctorServiceRow extends RowDataPacket {
    id: number;
    name: string;
    description: string | null;
    price: number | string;
    durationMinutes: number;
}

export class DoctorController {
    async list(req: Request, res: Response): Promise<void> {
        try {
            const [rows] = await pool.query<DoctorRow[]>(
                `SELECT
                    d.id,
                    d.first_name AS firstName,
                    d.last_name AS lastName,
                    d.biography,
                    d.image_url AS imageUrl,
                    s.id AS specialtyId,
                    s.name AS specialtyName,
                    rating_stats.averageRating,
                    COALESCE(rating_stats.reviewCount, 0) AS reviewCount
                 FROM doctors d
                 INNER JOIN specialties s ON s.id = d.specialty_id
                 ${DOCTOR_RATINGS_JOIN}
                 ORDER BY d.last_name, d.first_name`
            );

            const [locationRows] = await pool.query<DoctorLocationRow[]>(
                `SELECT
                    dl.doctor_id AS doctorId,
                    l.id,
                    l.name
                 FROM doctor_locations dl
                 INNER JOIN locations l ON l.id = dl.location_id
                 ORDER BY l.id`
            );

            const locationsByDoctor = new Map<number, { id: number; name: string }[]>();
            for (const row of locationRows) {
                const doctorId = Number(row.doctorId);
                const locations = locationsByDoctor.get(doctorId) ?? [];
                locations.push({
                    id: Number(row.id),
                    name: row.name
                });
                locationsByDoctor.set(doctorId, locations);
            }

            const [serviceRows] = await pool.query<DoctorServiceListRow[]>(
                `SELECT
                    ds.doctor_id AS doctorId,
                    sv.id,
                    sv.name
                 FROM doctor_services ds
                 INNER JOIN services sv ON sv.id = ds.service_id
                 ORDER BY sv.name`
            );

            const servicesByDoctor = new Map<number, { id: number; name: string }[]>();
            for (const row of serviceRows) {
                const doctorId = Number(row.doctorId);
                const services = servicesByDoctor.get(doctorId) ?? [];
                services.push({
                    id: Number(row.id),
                    name: row.name
                });
                servicesByDoctor.set(doctorId, services);
            }

            res.json(
                rows.map((row) => ({
                    id: Number(row.id),
                    firstName: row.firstName,
                    lastName: row.lastName,
                    biography: row.biography,
                    imageUrl: row.imageUrl,
                    specialty: {
                        id: Number(row.specialtyId),
                        name: row.specialtyName
                    },
                    locations: locationsByDoctor.get(Number(row.id)) ?? [],
                    services: servicesByDoctor.get(Number(row.id)) ?? [],
                    ...mapDoctorRating(row)
                }))
            );
        } catch (error) {
            console.error('Greška pri učitavanju lekara:', error);
            res.status(500).json({
                message: 'Trenutno nije moguće učitati podatke o lekarima.'
            });
        }
    }

    async getById(req: Request, res: Response): Promise<void> {
        const doctorId = Number(req.params.id);
        if (!Number.isInteger(doctorId) || doctorId <= 0) {
            res.status(404).json({ message: 'Lekar nije pronađen.' });
            return;
        }

        try {
            const [doctorRows] = await pool.query<DoctorRow[]>(
                `SELECT
                    d.id,
                    d.first_name AS firstName,
                    d.last_name AS lastName,
                    d.biography,
                    d.education,
                    d.professional_experience AS professionalExperience,
                    d.image_url AS imageUrl,
                    s.id AS specialtyId,
                    s.name AS specialtyName,
                    rating_stats.averageRating,
                    COALESCE(rating_stats.reviewCount, 0) AS reviewCount
                 FROM doctors d
                 INNER JOIN specialties s ON s.id = d.specialty_id
                 ${DOCTOR_RATINGS_JOIN}
                 WHERE d.id = ?
                 LIMIT 1`,
                [doctorId]
            );

            const doctor = doctorRows[0];
            if (!doctor) {
                res.status(404).json({ message: 'Lekar nije pronađen.' });
                return;
            }

            const [serviceRows] = await pool.query<DoctorServiceRow[]>(
                `SELECT
                    sv.id,
                    sv.name,
                    sv.description,
                    sv.price,
                    sv.duration_minutes AS durationMinutes
                 FROM doctor_services ds
                 INNER JOIN services sv ON sv.id = ds.service_id
                 WHERE ds.doctor_id = ?
                 ORDER BY sv.name`,
                [doctorId]
            );

            const [locationRows] = await pool.query<DoctorDetailLocationRow[]>(
                `SELECT
                    l.id,
                    l.name,
                    l.address,
                    l.city,
                    l.phone,
                    l.working_hours AS workingHours
                 FROM doctor_locations dl
                 INNER JOIN locations l ON l.id = dl.location_id
                 WHERE dl.doctor_id = ?
                 ORDER BY l.id`,
                [doctorId]
            );

            res.json({
                id: Number(doctor.id),
                firstName: doctor.firstName,
                lastName: doctor.lastName,
                biography: doctor.biography,
                education: doctor.education,
                professionalExperience: doctor.professionalExperience,
                imageUrl: doctor.imageUrl,
                specialty: {
                    id: Number(doctor.specialtyId),
                    name: doctor.specialtyName
                },
                ...mapDoctorRating(doctor),
                services: serviceRows.map((row) => ({
                    id: Number(row.id),
                    name: row.name,
                    description: row.description,
                    price: Number(row.price),
                    durationMinutes: Number(row.durationMinutes)
                })),
                locations: locationRows.map((row) => ({
                    id: Number(row.id),
                    name: row.name,
                    address: row.address,
                    city: row.city,
                    phone: row.phone,
                    workingHours: row.workingHours
                }))
            });
        } catch (error) {
            console.error('Greška pri učitavanju lekara:', error);
            res.status(500).json({
                message: 'Trenutno nije moguće učitati podatke o lekaru.'
            });
        }
    }
}
