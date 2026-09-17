import { Request, Response } from 'express';
import { AdminDoctorService } from '../portal/admin-doctor.service';
import { AdminPortalError, AdminPortalService } from '../portal/admin-portal.service';

export class AdminPortalController {
    constructor(
        private readonly portalService = new AdminPortalService(),
        private readonly doctorService = new AdminDoctorService()
    ) {}

    async dashboard(_req: Request, res: Response): Promise<void> {
        try {
            const dashboard = await this.portalService.getDashboard();
            res.status(200).json(dashboard);
        } catch (error) {
            this.handleError(res, error, 'Trenutno nije moguće učitati pregled.');
        }
    }

    async createDoctor(req: Request, res: Response): Promise<void> {
        try {
            const doctor = await this.doctorService.create(req.body);
            res.status(201).json(doctor);
        } catch (error) {
            this.handleError(res, error, 'Trenutno nije moguće dodati lekara.');
        }
    }

    async getDoctor(req: Request, res: Response): Promise<void> {
        try {
            const doctor = await this.doctorService.getById(Number(req.params.id));
            res.status(200).json(doctor);
        } catch (error) {
            this.handleError(res, error, 'Trenutno nije moguće učitati lekara.');
        }
    }

    async uploadDoctorImage(req: Request, res: Response): Promise<void> {
        try {
            const file = (req as Request & { file?: { mimetype: string; buffer: Buffer } }).file;
            const result = await this.doctorService.saveImage(
                Number(req.params.id),
                file?.mimetype,
                file?.buffer
            );
            res.status(201).json(result);
        } catch (error) {
            this.handleError(res, error, 'Trenutno nije moguće sačuvati fotografiju.');
        }
    }

    async updateDoctor(req: Request, res: Response): Promise<void> {
        try {
            const doctor = await this.doctorService.update(Number(req.params.id), req.body);
            res.status(200).json(doctor);
        } catch (error) {
            this.handleError(res, error, 'Trenutno nije moguće sačuvati izmene.');
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
