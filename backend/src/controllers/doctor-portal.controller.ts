import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { DoctorPortalError, DoctorPortalService } from '../portal/doctor-portal.service';

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
            this.handleError(res, error, 'Trenutno nije moguće učitati pregled dana.');
        }
    }

    async completeAppointment(req: Request, res: Response): Promise<void> {
        const doctorId = (req as AuthenticatedRequest).doctorId;
        if (!doctorId) {
            res.status(401).json({ message: 'Niste prijavljeni.' });
            return;
        }

        try {
            const result = await this.portalService.completeAppointment(
                doctorId,
                req.params.appointmentId,
                req.body ?? {}
            );
            res.status(200).json(result);
        } catch (error) {
            this.handleError(res, error, 'Trenutno nije moguće završiti pregled.');
        }
    }

    async listPatients(req: Request, res: Response): Promise<void> {
        const doctorId = (req as AuthenticatedRequest).doctorId;
        if (!doctorId) {
            res.status(401).json({ message: 'Niste prijavljeni.' });
            return;
        }

        try {
            const patients = await this.portalService.listPatients(doctorId);
            res.status(200).json(patients);
        } catch (error) {
            this.handleError(res, error, 'Trenutno nije moguće učitati pacijente.');
        }
    }

    async getPatient(req: Request, res: Response): Promise<void> {
        const doctorId = (req as AuthenticatedRequest).doctorId;
        if (!doctorId) {
            res.status(401).json({ message: 'Niste prijavljeni.' });
            return;
        }

        try {
            const detail = await this.portalService.getPatient(doctorId, req.params.patientId);
            res.status(200).json(detail);
        } catch (error) {
            this.handleError(res, error, 'Trenutno nije moguće učitati pacijenta.');
        }
    }

    async getAppointmentReport(req: Request, res: Response): Promise<void> {
        const doctorId = (req as AuthenticatedRequest).doctorId;
        if (!doctorId) {
            res.status(401).json({ message: 'Niste prijavljeni.' });
            return;
        }

        try {
            const report = await this.portalService.getAppointmentReport(
                doctorId,
                req.params.patientId,
                req.params.appointmentId
            );
            res.status(200).json(report);
        } catch (error) {
            this.handleError(res, error, 'Trenutno nije moguće učitati izveštaj.');
        }
    }

    private handleError(res: Response, error: unknown, fallback: string): void {
        if (error instanceof DoctorPortalError) {
            res.status(error.statusCode).json({ message: error.message });
            return;
        }

        console.error('Greška na portalu lekara:', error);
        res.status(500).json({ message: fallback });
    }
}
