import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { AdminAuthError, AdminAuthService } from '../auth/admin-auth.service';

export class AdminAuthController {
    constructor(private readonly authService = new AdminAuthService()) {}

    async login(req: Request, res: Response): Promise<void> {
        try {
            const result = await this.authService.login(req.body?.email, req.body?.password);
            res.status(200).json({
                message: 'Uspešno ste se prijavili.',
                token: result.token,
                admin: result.admin
            });
        } catch (error) {
            this.handleError(res, error, 'Došlo je do greške na serveru. Pokušajte ponovo.');
        }
    }

    async me(req: Request, res: Response): Promise<void> {
        try {
            const adminId = (req as AuthenticatedRequest).adminId;
            if (!adminId) {
                res.status(401).json({ message: 'Niste prijavljeni.' });
                return;
            }

            const admin = await this.authService.getMe(adminId);
            res.status(200).json(admin);
        } catch (error) {
            this.handleError(res, error, 'Trenutno nije moguće učitati nalog.');
        }
    }

    private handleError(res: Response, error: unknown, fallback: string): void {
        if (error instanceof AdminAuthError) {
            res.status(error.statusCode).json({ message: error.message });
            return;
        }

        console.error('Greška pri autentifikaciji administratora:', error);
        res.status(500).json({ message: fallback });
    }
}
