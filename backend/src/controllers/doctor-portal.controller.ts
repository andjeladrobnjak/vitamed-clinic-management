import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { DoctorPortalService } from '../portal/doctor-portal.service';

export class DoctorPortalController {
    constructor(private readonly portalService = new DoctorPortalService()) {}

    async dashboard(req: Request, res: Response): Promise<void> {
        const doctorId = (req as AuthenticatedRequest).doctorId;
        if (!doctorId) {
            res.status(401).json({ message: 'Niste prijavljeni.' });
            return;
        }

        try {
            const dashboard = await this.portalService.getDashboard(doctorId);
            res.status(200).json(dashboard);
        } catch (error) {
            console.error('Greška pri učitavanju portala lekara:', error);
            res.status(500).json({
                message: 'Trenutno nije moguće učitati pregled dana.'
            });
        }
    }
}
