import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import pool from '../db/connection';
import { parsePositiveId } from '../availability/availability.logic';
import { AdminPortalError } from './admin-portal.service';

interface ServiceRow extends RowDataPacket {
    id: number;
    name: string;
    description: string | null;
    price: number | string;
    durationMinutes: number;
    specialtyId: number;
    specialtyName: string;
}

interface IdRow extends RowDataPacket {
    id: number;
}

export interface AdminClinicService {
    id: number;
    name: string;
    description: string | null;
    price: number;
    durationMinutes: number;
    specialty: { id: number; name: string };
}

export class AdminClinicServiceService {
    async create(body: unknown): Promise<AdminClinicService> {
        const payload = this.parseCreatePayload(body);
        await this.assertSpecialty(payload.specialtyId);
        await this.assertUniqueName(payload.specialtyId, payload.name, null);

        try {
            const [result] = await pool.query<ResultSetHeader>(
                `INSERT INTO services (name, description, price, duration_minutes, specialty_id)
                 VALUES (?, ?, ?, ?, ?)`,
                [payload.name, payload.description, payload.price, payload.durationMinutes, payload.specialtyId]
            );

            const id = Number(result.insertId);
            if (!parsePositiveId(id)) {
                throw new AdminPortalError(500, 'Trenutno nije moguće dodati uslugu.');
            }

            return this.getById(id);
        } catch (error) {
            this.throwIfDuplicate(error);
            throw error;
        }
    }

    async update(id: number, body: unknown): Promise<AdminClinicService> {
        if (!parsePositiveId(id)) {
            throw new AdminPortalError(404, 'Usluga nije pronađena.');
        }

        const existing = await this.getById(id);
        const payload = this.parseUpdatePayload(body, existing.specialty.id);
        await this.assertUniqueName(existing.specialty.id, payload.name, id);

        try {
            await pool.query(
                `UPDATE services
                 SET name = ?,
                     description = ?,
                     price = ?,
                     duration_minutes = ?
                 WHERE id = ?`,
                [payload.name, payload.description, payload.price, payload.durationMinutes, id]
            );
        } catch (error) {
            this.throwIfDuplicate(error);
            throw error;
        }

        return this.getById(id);
    }

    private async getById(id: number): Promise<AdminClinicService> {
        const [rows] = await pool.query<ServiceRow[]>(
            `SELECT
                sv.id,
                sv.name,
                sv.description,
                sv.price,
                sv.duration_minutes AS durationMinutes,
                s.id AS specialtyId,
                s.name AS specialtyName
             FROM services sv
             INNER JOIN specialties s ON s.id = sv.specialty_id
             WHERE sv.id = ?
             LIMIT 1`,
            [id]
        );

        const row = rows[0];
        if (!row) {
            throw new AdminPortalError(404, 'Usluga nije pronađena.');
        }

        return this.mapRow(row);
    }

    private parseCreatePayload(body: unknown): {
        name: string;
        description: string | null;
        price: number;
        durationMinutes: number;
        specialtyId: number;
    } {
        const data = this.requireObject(body);
        const specialtyId = parsePositiveId(data['specialtyId']);
        if (!specialtyId) {
            throw new AdminPortalError(400, 'Izaberite specijalizaciju.');
        }

        return {
            name: this.requiredName(data['name']),
            description: this.optionalDescription(data['description']),
            price: this.requiredPrice(data['price']),
            durationMinutes: this.requiredDuration(data['durationMinutes']),
            specialtyId
        };
    }

    private parseUpdatePayload(
        body: unknown,
        currentSpecialtyId: number
    ): {
        name: string;
        description: string | null;
        price: number;
        durationMinutes: number;
    } {
        const data = this.requireObject(body);
        if (Object.prototype.hasOwnProperty.call(data, 'specialtyId')) {
            const nextSpecialtyId = parsePositiveId(data['specialtyId']);
            if (nextSpecialtyId !== currentSpecialtyId) {
                throw new AdminPortalError(400, 'Specijalizacija postojeće usluge se ne može menjati.');
            }
        }

        return {
            name: this.requiredName(data['name']),
            description: this.optionalDescription(data['description']),
            price: this.requiredPrice(data['price']),
            durationMinutes: this.requiredDuration(data['durationMinutes'])
        };
    }

    private requireObject(body: unknown): Record<string, unknown> {
        if (!body || typeof body !== 'object') {
            throw new AdminPortalError(400, 'Podaci o usluzi nisu ispravni.');
        }
        return body as Record<string, unknown>;
    }

    private requiredName(value: unknown): string {
        if (typeof value !== 'string') {
            throw new AdminPortalError(400, 'Unesite naziv usluge.');
        }

        const trimmed = value.trim();
        if (!trimmed) {
            throw new AdminPortalError(400, 'Unesite naziv usluge.');
        }

        if (trimmed.length > 150) {
            throw new AdminPortalError(400, 'Naziv usluge je predugačak.');
        }

        return trimmed;
    }

    private optionalDescription(value: unknown): string | null {
        if (value === null || value === undefined) {
            return null;
        }

        if (typeof value !== 'string') {
            throw new AdminPortalError(400, 'Opis usluge nije ispravan.');
        }

        const trimmed = value.trim();
        return trimmed || null;
    }

    private requiredPrice(value: unknown): number {
        const price = typeof value === 'number' ? value : Number(value);
        if (!Number.isFinite(price) || price <= 0) {
            throw new AdminPortalError(400, 'Unesite ispravnu cenu.');
        }

        const normalized = Math.round(price * 100) / 100;
        if (normalized <= 0 || normalized > 99999999.99) {
            throw new AdminPortalError(400, 'Unesite ispravnu cenu.');
        }

        return normalized;
    }

    private requiredDuration(value: unknown): number {
        const duration = parsePositiveId(value);
        if (!duration) {
            throw new AdminPortalError(400, 'Trajanje mora biti pozitivan broj minuta.');
        }

        return duration;
    }

    private async assertSpecialty(specialtyId: number): Promise<void> {
        const [rows] = await pool.query<IdRow[]>('SELECT id FROM specialties WHERE id = ? LIMIT 1', [
            specialtyId
        ]);
        if (!rows[0]) {
            throw new AdminPortalError(400, 'Izabrana specijalizacija nije ispravna.');
        }
    }

    private async assertUniqueName(specialtyId: number, name: string, excludeId: number | null): Promise<void> {
        const params: Array<string | number> = [specialtyId, name];
        let sql = `SELECT id
                   FROM services
                   WHERE specialty_id = ?
                     AND LOWER(TRIM(name)) = LOWER(?)`;

        if (excludeId) {
            sql += ' AND id <> ?';
            params.push(excludeId);
        }

        sql += ' LIMIT 1';
        const [rows] = await pool.query<IdRow[]>(sql, params);
        if (rows[0]) {
            throw new AdminPortalError(
                409,
                'Usluga sa ovim nazivom već postoji u izabranoj specijalizaciji.'
            );
        }
    }

    private throwIfDuplicate(error: unknown): void {
        if (
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            (error as { code?: string }).code === 'ER_DUP_ENTRY'
        ) {
            throw new AdminPortalError(
                409,
                'Usluga sa ovim nazivom već postoji u izabranoj specijalizaciji.'
            );
        }
    }

    private mapRow(row: ServiceRow): AdminClinicService {
        return {
            id: Number(row.id),
            name: row.name,
            description: row.description,
            price: Number(row.price),
            durationMinutes: Number(row.durationMinutes),
            specialty: {
                id: Number(row.specialtyId),
                name: row.specialtyName
            }
        };
    }
}
