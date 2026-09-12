import { Request, Response } from 'express';
import { ResultSetHeader } from 'mysql2';
import bcrypt from 'bcrypt';
import pool from '../db/connection';

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
}
