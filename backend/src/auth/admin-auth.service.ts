import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { RowDataPacket } from 'mysql2';
import pool from '../db/connection';

export class AdminAuthError extends Error {
    constructor(
        public readonly statusCode: number,
        message: string
    ) {
        super(message);
        this.name = 'AdminAuthError';
    }
}

export interface AdminAuthSession {
    id: number;
    email: string;
    role: 'admin';
}

interface AdminAccountRow extends RowDataPacket {
    id: number;
    email: string;
    passwordHash: string;
    isActive: number | boolean;
}

const GENERIC_LOGIN_ERROR = 'Email ili lozinka nisu ispravni.';

export class AdminAuthService {
    async login(email: unknown, password: unknown): Promise<{ token: string; admin: AdminAuthSession }> {
        if (!email || !password) {
            throw new AdminAuthError(400, 'Sva polja su obavezna.');
        }

        const trimmedEmail = String(email).trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
            throw new AdminAuthError(400, 'Unesite ispravnu email adresu.');
        }

        const row = await this.findAccountByEmail(trimmedEmail);
        if (!row) {
            throw new AdminAuthError(401, GENERIC_LOGIN_ERROR);
        }

        const passwordMatches = await bcrypt.compare(String(password), row.passwordHash);
        if (!passwordMatches || !this.isActive(row.isActive)) {
            throw new AdminAuthError(401, GENERIC_LOGIN_ERROR);
        }

        return {
            token: this.signAdminToken(Number(row.id)),
            admin: this.toSession(row)
        };
    }

    async getMe(adminId: number): Promise<AdminAuthSession> {
        const [rows] = await pool.query<(RowDataPacket & {
            id: number;
            email: string;
            isActive: number | boolean;
        })[]>(
            `SELECT id, email, is_active AS isActive
             FROM admin_accounts
             WHERE id = ?
             LIMIT 1`,
            [adminId]
        );

        const row = rows[0];
        if (!row || Number(row.id) !== adminId || !this.isActive(row.isActive)) {
            throw new AdminAuthError(401, 'Niste prijavljeni.');
        }

        return {
            id: Number(row.id),
            email: String(row.email),
            role: 'admin'
        };
    }

    private async findAccountByEmail(email: string): Promise<AdminAccountRow | null> {
        const [rows] = await pool.query<AdminAccountRow[]>(
            `SELECT
                id,
                email,
                password_hash AS passwordHash,
                is_active AS isActive
             FROM admin_accounts
             WHERE email = ?
             LIMIT 1`,
            [email]
        );

        return rows[0] ?? null;
    }

    private signAdminToken(adminId: number): string {
        const jwtSecret = process.env.JWT_SECRET;
        const jwtExpiresIn = process.env.JWT_EXPIRES_IN;

        if (!jwtSecret || !jwtExpiresIn) {
            throw new AdminAuthError(500, 'Došlo je do greške na serveru. Pokušajte ponovo.');
        }

        return jwt.sign(
            {
                role: 'admin',
                adminId
            },
            jwtSecret,
            { expiresIn: jwtExpiresIn as SignOptions['expiresIn'] }
        );
    }

    private toSession(row: AdminAccountRow): AdminAuthSession {
        return {
            id: Number(row.id),
            email: String(row.email),
            role: 'admin'
        };
    }

    private isActive(value: number | boolean): boolean {
        return value === true || value === 1;
    }
}
