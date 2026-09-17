import { Request, Response } from 'express';
import { AdminPortalError, AdminPortalService } from '../portal/admin-portal.service';

export class AdminPortalController {
    constructor(private readonly portalService = new AdminPortalService()) {}

    async dashboard(_req: Request, res: Response): Promise<void> {
        try {
            const dashboard = await this.portalService.getDashboard();
            res.status(200).json(dashboard);
        } catch (error) {
            this.handleError(res, error, 'Trenutno nije moguće učitati pregled.');
        }
    }

    private handleError(res: Response, error: unknown, fallback: string): void {
        if (error instanceof AdminPortalError) {
            res.status(error.statusCode).json({ message: error.message });
            return;
        }

        console.error('Greška na administratorskom portalu:', error);
        res.status(500).json({ message: fallback });
    }
}
