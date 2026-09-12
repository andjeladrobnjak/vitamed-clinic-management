import { Request, Response } from 'express';
import { ResultSetHeader } from 'mysql2';
import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import pool from '../db/connection';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export class PatientController {
    async register(req: Request, res: Response): Promise<void> {
        try {
            const {
                firstName,
                lastName,
                jmbg,
                email,
                phone,
                password,
                confirmPassword
            } = req.body;

            if (
                !firstName ||
                !lastName ||
                !jmbg ||
                !email ||
                !phone ||
                !password ||
                !confirmPassword
            ) {
                res.status(400).json({
                    message: 'Sva polja su obavezna.'
                });
                return;
            }

            const trimmedFirstName = String(firstName).trim();
            const trimmedLastName = String(lastName).trim();
            const trimmedJmbg = String(jmbg).trim();
            const trimmedEmail = String(email).trim().toLowerCase();
            const trimmedPhone = String(phone).trim();

            if (!/^\d{13}$/.test(trimmedJmbg)) {
                res.status(400).json({
                    message: 'JMBG mora sadržati tačno 13 cifara.'
                });
                return;
            }

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
                res.status(400).json({
                    message: 'Unesite ispravnu email adresu.'
                });
                return;
            }

            if (!/^\+381 \d{2} \d{3} \d{4}$/.test(trimmedPhone)) {
                res.status(400).json({
                    message: 'Unesite ispravan broj telefona.'
                });
                return;
            }

            if (String(password).length < 8) {
                res.status(400).json({
                    message: 'Lozinka mora imati najmanje 8 karaktera.'
                });
                return;
            }

            if (password !== confirmPassword) {
                res.status(400).json({
                    message: 'Lozinke se ne poklapaju.'
                });
                return;
            }

            const [existingPatients] = await pool.query(
                'SELECT id FROM patients WHERE email = ? OR jmbg = ? LIMIT 1',
                [trimmedEmail, trimmedJmbg]
            );

            if (Array.isArray(existingPatients) && existingPatients.length > 0) {
                res.status(409).json({
                    message: 'Pacijent sa unetim emailom ili JMBG-om već postoji.'
                });
                return;
            }

            const passwordHash = await bcrypt.hash(password, 10);

            const [result] = await pool.query<ResultSetHeader>(
                `INSERT INTO patients (first_name, last_name, jmbg, email, phone, password_hash)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    trimmedFirstName,
                    trimmedLastName,
                    trimmedJmbg,
                    trimmedEmail,
                    trimmedPhone,
                    passwordHash
                ]
            );

            res.status(201).json({
                message: 'Pacijent je uspešno registrovan.',
                patientId: result.insertId
            });
        } catch (error) {
            console.error('Greška pri registraciji pacijenta:', error);
            res.status(500).json({
                message: 'Došlo je do greške na serveru. Pokušajte ponovo.'
            });
        }
    }

    async login(req: Request, res: Response): Promise<void> {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                res.status(400).json({
                    message: 'Sva polja su obavezna.'
                });
                return;
            }

            const trimmedEmail = String(email).trim().toLowerCase();

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
                res.status(400).json({
                    message: 'Unesite ispravnu email adresu.'
                });
                return;
            }

            const [patients] = await pool.query(
                `SELECT id, first_name, last_name, email, password_hash
                 FROM patients
                 WHERE email = ?
                 LIMIT 1`,
                [trimmedEmail]
            );

            if (!Array.isArray(patients) || patients.length === 0) {
                res.status(401).json({
                    message: 'Email ili lozinka nisu ispravni.'
                });
                return;
            }

            const patient = patients[0] as {
                id: number;
                first_name: string;
                last_name: string;
                email: string;
                password_hash: string;
            };

            const passwordMatches = await bcrypt.compare(String(password), patient.password_hash);

            if (!passwordMatches) {
                res.status(401).json({
                    message: 'Email ili lozinka nisu ispravni.'
                });
                return;
            }

            const jwtSecret = process.env.JWT_SECRET;
            const jwtExpiresIn = process.env.JWT_EXPIRES_IN;

            if (!jwtSecret || !jwtExpiresIn) {
                res.status(500).json({
                    message: 'Došlo je do greške na serveru. Pokušajte ponovo.'
                });
                return;
            }

            const token = jwt.sign(
                { patientId: patient.id },
                jwtSecret,
                { expiresIn: jwtExpiresIn as SignOptions['expiresIn'] }
            );

            res.status(200).json({
                message: 'Uspešno ste se prijavili.',
                token,
                patient: {
                    id: patient.id,
                    firstName: patient.first_name,
                    lastName: patient.last_name,
                    email: patient.email
                }
            });
        } catch (error) {
            console.error('Greška pri prijavi pacijenta:', error);
            res.status(500).json({
                message: 'Došlo je do greške na serveru. Pokušajte ponovo.'
            });
        }
    }

    async me(req: Request, res: Response): Promise<void> {
        try {
            const patientId = (req as AuthenticatedRequest).patientId;

            if (!patientId) {
                res.status(401).json({
                    message: 'Niste prijavljeni.'
                });
                return;
            }

            const [patients] = await pool.query(
                `SELECT id, first_name, last_name, email
                 FROM patients
                 WHERE id = ?
                 LIMIT 1`,
                [patientId]
            );

            if (!Array.isArray(patients) || patients.length === 0) {
                res.status(401).json({
                    message: 'Niste prijavljeni.'
                });
                return;
            }

            const patient = patients[0] as {
                id: number;
                first_name: string;
                last_name: string;
                email: string;
            };

            res.status(200).json({
                id: patient.id,
                firstName: patient.first_name,
                lastName: patient.last_name,
                email: patient.email
            });
        } catch (error) {
            console.error('Greška pri dohvatanju pacijenta:', error);
            res.status(500).json({
                message: 'Došlo je do greške na serveru. Pokušajte ponovo.'
            });
        }
    }
}
