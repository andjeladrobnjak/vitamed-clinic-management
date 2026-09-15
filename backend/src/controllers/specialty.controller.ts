import { Request, Response } from 'express';
import { RowDataPacket } from 'mysql2';
import pool from '../db/connection';
import { SPECIALTY_NAME_BY_SLUG, slugFromSpecialtyName } from '../specialty-slugs';

interface SpecialtyRow extends RowDataPacket {
    id: number;
    name: string;
    description: string | null;
    imageUrl: string | null;
}

interface ServiceRow extends RowDataPacket {
    id: number;
    name: string;
    description: string | null;
    price: number | string;
    durationMinutes: number;
}

interface DoctorRow extends RowDataPacket {
    id: number;
    firstName: string;
    lastName: string;
    biography: string | null;
    imageUrl: string | null;
}

export class SpecialtyController {
    async list(req: Request, res: Response): Promise<void> {
        try {
            const [rows] = await pool.query<SpecialtyRow[]>(
                'SELECT id, name FROM specialties ORDER BY name'
            );

            res.json(
                rows.map((row) => ({
                    id: Number(row.id),
                    name: row.name,
                    slug: slugFromSpecialtyName(row.name)
                }))
            );
        } catch (error) {
            console.error('Greška pri učitavanju specijalizacija:', error);
            res.status(500).json({
                message: 'Trenutno nije moguće učitati specijalizacije.'
            });
        }
    }

    async getBySlug(req: Request, res: Response): Promise<void> {
        const slug = String(req.params.slug ?? '').trim().toLowerCase();
        const specialtyName = SPECIALTY_NAME_BY_SLUG[slug];

        if (!specialtyName) {
            res.status(404).json({
                message: 'Specijalizacija nije pronađena.'
            });
            return;
        }

        try {
            const [specialtyRows] = await pool.query<SpecialtyRow[]>(
                `SELECT
                    id,
                    name,
                    description,
                    image_url AS imageUrl
                 FROM specialties
                 WHERE name = ?
                 LIMIT 1`,
                [specialtyName]
            );

            const specialty = specialtyRows[0];
            if (!specialty) {
                res.status(404).json({
                    message: 'Specijalizacija nije pronađena.'
                });
                return;
            }

            const specialtyId = Number(specialty.id);

            const [serviceRows] = await pool.query<ServiceRow[]>(
                `SELECT
                    id,
                    name,
                    description,
                    price,
                    duration_minutes AS durationMinutes
                 FROM services
                 WHERE specialty_id = ?
                 ORDER BY name`,
                [specialtyId]
            );

            const [doctorRows] = await pool.query<DoctorRow[]>(
                `SELECT
                    id,
                    first_name AS firstName,
                    last_name AS lastName,
                    biography,
                    image_url AS imageUrl
                 FROM doctors
                 WHERE specialty_id = ?
                 ORDER BY last_name, first_name`,
                [specialtyId]
            );

            res.json({
                id: specialtyId,
                name: specialty.name,
                slug,
                description: specialty.description,
                imageUrl: specialty.imageUrl,
                services: serviceRows.map((row) => ({
                    id: Number(row.id),
                    name: row.name,
                    description: row.description,
                    price: Number(row.price),
                    durationMinutes: Number(row.durationMinutes)
                })),
                doctors: doctorRows.map((row) => ({
                    id: Number(row.id),
                    firstName: row.firstName,
                    lastName: row.lastName,
                    biography: row.biography,
                    imageUrl: row.imageUrl,
                    specialty: {
                        id: specialtyId,
                        name: specialty.name,
                        slug
                    }
                }))
            });
        } catch (error) {
            console.error('Greška pri učitavanju specijalizacije:', error);
            res.status(500).json({
                message: 'Trenutno nije moguće učitati specijalizaciju.'
            });
        }
    }
}
