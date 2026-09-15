import { Request, Response } from 'express';
import { RowDataPacket } from 'mysql2';
import pool from '../db/connection';

interface LocationRow extends RowDataPacket {
    id: number;
    name: string;
    address: string;
    city: string;
    phone: string;
    workingHours: string;
    latitude: number | string;
    longitude: number | string;
}

export class LocationController {
    async list(req: Request, res: Response): Promise<void> {
        try {
            const [rows] = await pool.query<LocationRow[]>(
                `SELECT
                    id,
                    name,
                    address,
                    city,
                    phone,
                    working_hours AS workingHours,
                    latitude,
                    longitude
                 FROM locations
                 ORDER BY id ASC`
            );

            res.json(
                rows.map((row) => ({
                    id: Number(row.id),
                    name: row.name,
                    address: row.address,
                    city: row.city,
                    phone: row.phone,
                    workingHours: row.workingHours,
                    latitude: Number(row.latitude),
                    longitude: Number(row.longitude)
                }))
            );
        } catch (error) {
            console.error('Greška pri učitavanju lokacija:', error);
            res.status(500).json({
                message: 'Trenutno nije moguće učitati lokacije.'
            });
        }
    }
}
