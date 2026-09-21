import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { RowDataPacket } from 'mysql2';
import pool from '../db/connection';
import { BCRYPT_ROUNDS, validateDoctorPassword } from './doctor-password';

export class DoctorAuthError extends Error {
    constructor(
        public readonly statusCode: number,
        message: string
    ) {
        super(message);
        this.name = 'DoctorAuthError';
    }
}

export interface DoctorAuthSession {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    specialty: {
        id: number;
        name: string;
    };
    mustChangePassword: boolean;
}

interface DoctorAccountAuthRow extends RowDataPacket {
    accountId: number;
    doctorId: number;
    email: string;
    passwordHash: string;
    isActive: number | boolean;
    doctorIsActive: number | boolean;
    mustChangePassword: number | boolean;
    firstName: string;
    lastName: string;
    specialtyId: number;
    specialtyName: string;
}

const GENERIC_LOGIN_ERROR = 'Email ili lozinka nisu ispravni.';

export class DoctorAuthService {
    async login(email: unknown, password: unknown): Promise<{ token: string; doctor: DoctorAuthSession }> {
        if (!email || !password) {
            throw new DoctorAuthError(400, 'Sva polja su obavezna.');
        }

        const trimmedEmail = String(email).trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
            throw new DoctorAuthError(400, 'Unesite ispravnu email adresu.');
        }

        const row = await this.findAccountByEmail(trimmedEmail);
        if (!row) {
            throw new DoctorAuthError(401, GENERIC_LOGIN_ERROR);
        }

        const passwordMatches = await bcrypt.compare(String(password), row.passwordHash);
        if (!passwordMatches || !this.isActive(row.isActive) || !this.isActive(row.doctorIsActive)) {
            throw new DoctorAuthError(401, GENERIC_LOGIN_ERROR);
        }

        const token = this.signDoctorToken(Number(row.accountId), Number(row.doctorId));

        return {
            token,
            doctor: this.toSession(row)
        };
    }

    async changePassword(
        accountId: number,
        doctorId: number,
        newPasswordInput: unknown,
        confirmPasswordInput: unknown
    ): Promise<{ token: string; doctor: DoctorAuthSession }> {
        if (!newPasswordInput || !confirmPasswordInput) {
            throw new DoctorAuthError(400, 'Sva polja su obavezna.');
        }

        const newPassword = String(newPasswordInput);
        const confirmPassword = String(confirmPasswordInput);
        if (newPassword !== confirmPassword) {
            throw new DoctorAuthError(400, 'Lozinke se ne podudaraju.');
        }

        const policyError = validateDoctorPassword(newPassword);
        if (policyError) {
            throw new DoctorAuthError(400, policyError);
        }

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [rows] = await connection.query<DoctorAccountAuthRow[]>(
                `SELECT
                    a.id AS accountId,
                    a.doctor_id AS doctorId,
                    a.email,
                    a.password_hash AS passwordHash,
                    a.is_active AS isActive,
                    d.is_active AS doctorIsActive,
                    a.must_change_password AS mustChangePassword,
                    d.first_name AS firstName,
                    d.last_name AS lastName,
                    s.id AS specialtyId,
                    s.name AS specialtyName
                 FROM doctor_accounts a
                 INNER JOIN doctors d ON d.id = a.doctor_id
                 INNER JOIN specialties s ON s.id = d.specialty_id
                 WHERE a.id = ?
                 LIMIT 1
                 FOR UPDATE`,
                [accountId]
            );

            const row = rows[0];
            if (
                !row
                || Number(row.accountId) !== accountId
                || Number(row.doctorId) !== doctorId
                || !this.isActive(row.isActive)
                || !this.isActive(row.doctorIsActive)
            ) {
                throw new DoctorAuthError(401, 'Niste prijavljeni.');
            }

            const matchesCurrent = await bcrypt.compare(newPassword, row.passwordHash);
            if (matchesCurrent) {
                throw new DoctorAuthError(400, 'Nova lozinka mora da se razlikuje od privremene lozinke.');
            }

            const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
            await connection.query(
                `UPDATE doctor_accounts
                 SET password_hash = ?, must_change_password = FALSE
                 WHERE id = ? AND doctor_id = ?`,
                [passwordHash, accountId, doctorId]
            );

            await connection.commit();
            const session = this.toSession({
                ...row,
                mustChangePassword: false
            });
            return {
                token: this.signDoctorToken(accountId, doctorId),
                doctor: session
            };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    async refresh(accountId: number, doctorId: number): Promise<{ token: string; doctor: DoctorAuthSession }> {
        const doctor = await this.getMe(accountId, doctorId);
        return {
            token: this.signDoctorToken(accountId, doctorId),
            doctor
        };
    }

    async getMe(accountId: number, doctorId: number): Promise<DoctorAuthSession> {
        const [rows] = await pool.query<(RowDataPacket & {
            accountId: number;
            doctorId: number;
            email: string;
            isActive: number | boolean;
            doctorIsActive: number | boolean;
            mustChangePassword: number | boolean;
            firstName: string;
            lastName: string;
            specialtyId: number;
            specialtyName: string;
        })[]>(
            `SELECT
                a.id AS accountId,
                a.doctor_id AS doctorId,
                a.email,
                a.is_active AS isActive,
                d.is_active AS doctorIsActive,
                a.must_change_password AS mustChangePassword,
                d.first_name AS firstName,
                d.last_name AS lastName,
                s.id AS specialtyId,
                s.name AS specialtyName
             FROM doctor_accounts a
             INNER JOIN doctors d ON d.id = a.doctor_id
             INNER JOIN specialties s ON s.id = d.specialty_id
             WHERE a.id = ?
             LIMIT 1`,
            [accountId]
        );

        const row = rows[0];
        if (
            !row
            || Number(row.accountId) !== accountId
            || Number(row.doctorId) !== doctorId
            || !this.isActive(row.isActive)
            || !this.isActive(row.doctorIsActive)
        ) {
            throw new DoctorAuthError(401, 'Niste prijavljeni.');
        }

        return this.toSession(row);
    }

    private async findAccountByEmail(email: string): Promise<DoctorAccountAuthRow | null> {
        const [rows] = await pool.query<DoctorAccountAuthRow[]>(
            `SELECT
                a.id AS accountId,
                a.doctor_id AS doctorId,
                a.email,
                a.password_hash AS passwordHash,
                a.is_active AS isActive,
                d.is_active AS doctorIsActive,
                a.must_change_password AS mustChangePassword,
                d.first_name AS firstName,
                d.last_name AS lastName,
                s.id AS specialtyId,
                s.name AS specialtyName
             FROM doctor_accounts a
             INNER JOIN doctors d ON d.id = a.doctor_id
             INNER JOIN specialties s ON s.id = d.specialty_id
             WHERE a.email = ?
             LIMIT 1`,
            [email]
        );

        return rows[0] ?? null;
    }

    private signDoctorToken(accountId: number, doctorId: number): string {
        const jwtSecret = process.env.JWT_SECRET;
        const jwtExpiresIn = process.env.JWT_EXPIRES_IN;

        if (!jwtSecret || !jwtExpiresIn) {
            throw new DoctorAuthError(500, 'Došlo je do greške na serveru. Pokušajte ponovo.');
        }

        return jwt.sign(
            {
                role: 'doctor',
                accountId,
                doctorId
            },
            jwtSecret,
            { expiresIn: jwtExpiresIn as SignOptions['expiresIn'] }
        );
    }

    private toSession(row: Omit<DoctorAccountAuthRow, 'passwordHash'>): DoctorAuthSession {
        return {
            id: Number(row.doctorId),
            firstName: row.firstName,
            lastName: row.lastName,
            email: row.email,
            specialty: {
                id: Number(row.specialtyId),
                name: row.specialtyName
            },
            mustChangePassword: row.mustChangePassword === true || row.mustChangePassword === 1
        };
    }

    private isActive(value: number | boolean): boolean {
        return value === true || value === 1;
    }
}
