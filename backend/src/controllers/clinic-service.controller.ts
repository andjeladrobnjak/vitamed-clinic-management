import { Request, Response } from 'express';
import { RowDataPacket } from 'mysql2';
import pool from '../db/connection';

interface ServiceRow extends RowDataPacket {
    id: number;
    name: string;
    description: string | null;
    price: number | string;
    durationMinutes: number;
    specialtyId: number;
    specialtyName: string;
}

export class ClinicServiceController {
    async list(req: Request, res: Response): Promise<void> {
        try {
            const specialtyId = req.query.specialtyId
                ? Number(req.query.specialtyId)
                : null;

            const params: number[] = [];
            let sql = `
                SELECT
                    sv.id,
                    sv.name,
                    sv.description,
                    sv.price,
                    sv.duration_minutes AS durationMinutes,
                    s.id AS specialtyId,
                    s.name AS specialtyName
                FROM services sv
                INNER JOIN specialties s ON s.id = sv.specialty_id
            `;

            if (specialtyId && Number.isFinite(specialtyId)) {
                sql += ' WHERE sv.specialty_id = ?';
                params.push(specialtyId);
            }

            sql += ' ORDER BY s.name, sv.name';

            const [rows] = await pool.query<ServiceRow[]>(sql, params);

            res.json(
                rows.map((row) => ({
                    id: Number(row.id),
                    name: row.name,
                    description: row.description,
                    price: Number(row.price),
                    durationMinutes: Number(row.durationMinutes),
                    specialty: {
                        id: Number(row.specialtyId),
                        name: row.specialtyName
                    }
                }))
            );
        } catch (error) {
            console.error('Greška pri učitavanju usluga:', error);
            res.status(500).json({
                message: 'Trenutno nije moguće učitati usluge.'
            });
        }
    }
}
