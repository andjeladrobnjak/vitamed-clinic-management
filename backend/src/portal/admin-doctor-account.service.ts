import bcrypt from 'bcrypt';
import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import pool from '../db/connection';
import { parsePositiveId } from '../availability/availability.logic';
import { AdminPortalError } from './admin-portal.service';
import {
    BCRYPT_ROUNDS,
    generateTemporaryPassword,
    nextVitamedEmail,
    suggestVitamedEmail,
    validateDoctorPassword
} from '../auth/doctor-password';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface AccountRow extends RowDataPacket {
    id: number;
    doctorId: number;
    email: string;
    mustChangePassword: number | boolean;
}

interface DoctorNameRow extends RowDataPacket {
    id: number;
    firstName: string;
    lastName: string;
}

interface IdRow extends RowDataPacket {
    id: number;
}

export type AdminDoctorAccountStatus = 'missing' | 'pending' | 'active';

export interface AdminDoctorAccountView {
    status: AdminDoctorAccountStatus;
    email: string | null;
    mustChangePassword: boolean;
}

export interface AdminGeneratedPassword {
    password: string;
}

export interface AdminProvisionedAccount {
    message: string;
    account: AdminDoctorAccountView;
    temporaryPassword: string;
}

export class AdminDoctorAccountService {
    async getStatus(doctorIdInput: unknown): Promise<AdminDoctorAccountView> {
        const doctorId = await this.requireDoctorId(doctorIdInput);
        const account = await this.findAccount(doctorId);
        return this.toView(account);
    }

    async suggestEmail(doctorIdInput: unknown): Promise<{ email: string }> {
        const doctorId = await this.requireDoctorId(doctorIdInput);
        const doctor = await this.loadDoctorName(doctorId);
        const suggested = suggestVitamedEmail(doctor.firstName, doctor.lastName);
        const taken = await this.existingEmails();
        return { email: nextVitamedEmail(suggested, taken) };
    }

    generatePassword(): AdminGeneratedPassword {
        return { password: generateTemporaryPassword() };
    }

    async create(
        doctorIdInput: unknown,
        body: Record<string, unknown>
    ): Promise<AdminProvisionedAccount> {
        const doctorId = parsePositiveId(doctorIdInput);
        if (!doctorId) {
            throw new AdminPortalError(404, 'Lekar nije pronađen.');
        }

        const email = this.readEmail(body['email']);
        const password = this.readPassword(body['password']);

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [doctorRows] = await connection.query<(IdRow & { isActive?: number | boolean })[]>(
                'SELECT id, is_active AS isActive FROM doctors WHERE id = ? LIMIT 1 FOR UPDATE',
                [doctorId]
            );
            if (!doctorRows[0]) {
                throw new AdminPortalError(404, 'Lekar nije pronađen.');
            }
            const doctorIsActive = doctorRows[0].isActive === true || doctorRows[0].isActive === 1;

            const [existingRows] = await connection.query<IdRow[]>(
                'SELECT id FROM doctor_accounts WHERE doctor_id = ? LIMIT 1 FOR UPDATE',
                [doctorId]
            );
            if (existingRows[0]) {
                throw new AdminPortalError(409, 'Nalog za ovog lekara je već kreiran.');
            }

            const [emailRows] = await connection.query<IdRow[]>(
                'SELECT id FROM doctor_accounts WHERE email = ? LIMIT 1 FOR UPDATE',
                [email]
            );
            if (emailRows[0]) {
                throw new AdminPortalError(409, 'Navedena email adresa je već u upotrebi.');
            }

            const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
            try {
                await connection.query<ResultSetHeader>(
                    `INSERT INTO doctor_accounts
                        (doctor_id, email, password_hash, is_active, must_change_password)
                     VALUES (?, ?, ?, ?, TRUE)`,
                    [doctorId, email, passwordHash, doctorIsActive]
                );
            } catch (error) {
                if (this.isDuplicate(error)) {
                    const detail = String((error as { sqlMessage?: string }).sqlMessage ?? '');
                    if (detail.includes('uq_doctor_accounts_email') || detail.toLowerCase().includes('email')) {
                        throw new AdminPortalError(409, 'Navedena email adresa je već u upotrebi.');
                    }
                    throw new AdminPortalError(409, 'Nalog za ovog lekara je već kreiran.');
                }
                throw error;
            }

            await connection.commit();
            return {
                message: 'Nalog je uspešno kreiran.',
                account: {
                    status: 'pending',
                    email,
                    mustChangePassword: true
                },
                temporaryPassword: password
            };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    async resetPassword(doctorIdInput: unknown): Promise<AdminProvisionedAccount> {
        const doctorId = await this.requireDoctorId(doctorIdInput);
        const password = generateTemporaryPassword();
        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [rows] = await connection.query<AccountRow[]>(
                `SELECT
                    id,
                    doctor_id AS doctorId,
                    email,
                    must_change_password AS mustChangePassword
                 FROM doctor_accounts
                 WHERE doctor_id = ?
                 LIMIT 1
                 FOR UPDATE`,
                [doctorId]
            );
            const account = rows[0];
            if (!account) {
                throw new AdminPortalError(404, 'Nalog lekara nije pronađen.');
            }

            await connection.query(
                `UPDATE doctor_accounts
                 SET password_hash = ?, must_change_password = TRUE
                 WHERE id = ? AND doctor_id = ?`,
                [passwordHash, Number(account.id), doctorId]
            );

            await connection.commit();
            return {
                message: 'Lozinka je uspešno resetovana.',
                account: {
                    status: 'pending',
                    email: String(account.email),
                    mustChangePassword: true
                },
                temporaryPassword: password
            };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    private async requireDoctorId(doctorIdInput: unknown): Promise<number> {
        const doctorId = parsePositiveId(doctorIdInput);
        if (!doctorId) {
            throw new AdminPortalError(404, 'Lekar nije pronađen.');
        }
        const [rows] = await pool.query<IdRow[]>('SELECT id FROM doctors WHERE id = ? LIMIT 1', [doctorId]);
        if (!rows[0]) {
            throw new AdminPortalError(404, 'Lekar nije pronađen.');
        }
        return doctorId;
    }

    private async loadDoctorName(doctorId: number): Promise<DoctorNameRow> {
        const [rows] = await pool.query<DoctorNameRow[]>(
            'SELECT id, first_name AS firstName, last_name AS lastName FROM doctors WHERE id = ? LIMIT 1',
            [doctorId]
        );
        if (!rows[0]) {
            throw new AdminPortalError(404, 'Lekar nije pronađen.');
        }
        return rows[0];
    }

    private async findAccount(doctorId: number): Promise<AccountRow | null> {
        const [rows] = await pool.query<AccountRow[]>(
            `SELECT
                id,
                doctor_id AS doctorId,
                email,
                must_change_password AS mustChangePassword
             FROM doctor_accounts
             WHERE doctor_id = ?
             LIMIT 1`,
            [doctorId]
        );
        return rows[0] ?? null;
    }

    private async existingEmails(): Promise<Set<string>> {
        const [rows] = await pool.query<(RowDataPacket & { email: string })[]>(
            'SELECT email FROM doctor_accounts'
        );
        return new Set(rows.map((row) => String(row.email).toLowerCase()));
    }

    private toView(account: AccountRow | null): AdminDoctorAccountView {
        if (!account) {
            return {
                status: 'missing',
                email: null,
                mustChangePassword: false
            };
        }
        const mustChangePassword = account.mustChangePassword === true || account.mustChangePassword === 1;
        return {
            status: mustChangePassword ? 'pending' : 'active',
            email: String(account.email),
            mustChangePassword
        };
    }

    private readEmail(value: unknown): string {
        if (typeof value !== 'string' || !value.trim()) {
            throw new AdminPortalError(400, 'Unesite ispravnu email adresu.');
        }
        const email = value.trim().toLowerCase();
        if (!EMAIL_PATTERN.test(email)) {
            throw new AdminPortalError(400, 'Unesite ispravnu email adresu.');
        }
        return email;
    }

    private readPassword(value: unknown): string {
        if (typeof value !== 'string' || !value.trim()) {
            throw new AdminPortalError(400, 'Privremena lozinka nije mogla da bude generisana. Pokušajte ponovo.');
        }
        const password = value.trim();
        if (validateDoctorPassword(password)) {
            throw new AdminPortalError(400, 'Privremena lozinka nije mogla da bude generisana. Pokušajte ponovo.');
        }
        if (!/[#@$%&*!?]/.test(password)) {
            throw new AdminPortalError(400, 'Privremena lozinka nije mogla da bude generisana. Pokušajte ponovo.');
        }
        return password;
    }

    private isDuplicate(error: unknown): boolean {
        return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY';
    }
}
