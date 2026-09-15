import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { DoctorAuthError, DoctorAuthService } from '../auth/doctor-auth.service';

export class DoctorAuthController {
    constructor(private readonly authService = new DoctorAuthService()) {}

    async login(req: Request, res: Response): Promise<void> {
        try {
            const result = await this.authService.login(req.body?.email, req.body?.password);
            res.status(200).json({
                message: 'Uspešno ste se prijavili.',
                token: result.token,
                doctor: result.doctor
            });
        } catch (error) {
            this.handleError(res, error, 'Došlo je do greške na serveru. Pokušajte ponovo.');
        }
    }

    async me(req: Request, res: Response): Promise<void> {
        try {
            const accountId = (req as AuthenticatedRequest).doctorAccountId;
            const doctorId = (req as AuthenticatedRequest).doctorId;

            if (!accountId || !doctorId) {
                res.status(401).json({ message: 'Niste prijavljeni.' });
                return;
            }

            const doctor = await this.authService.getMe(accountId, doctorId);
            res.status(200).json(doctor);
        } catch (error) {
            this.handleError(res, error, 'Trenutno nije moguće učitati nalog.');
        }
    }

    private handleError(res: Response, error: unknown, fallback: string): void {
        if (error instanceof DoctorAuthError) {
            res.status(error.statusCode).json({ message: error.message });
            return;
        }

        console.error('Greška pri autentifikaciji lekara:', error);
        res.status(500).json({ message: fallback });
    }
}
