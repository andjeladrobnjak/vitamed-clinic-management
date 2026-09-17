import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { MailService } from '../mail/mail.service';
import { DoctorPortalError, DoctorPortalService } from '../portal/doctor-portal.service';

export class DoctorPortalController {
    constructor(
        private readonly portalService = new DoctorPortalService(),
        private readonly mailService = new MailService()
    ) {}

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

    async updateAppointmentReport(req: Request, res: Response): Promise<void> {
        const doctorId = (req as AuthenticatedRequest).doctorId;
        if (!doctorId) {
            res.status(401).json({ message: 'Niste prijavljeni.' });
            return;
        }

        try {
            const report = await this.portalService.updateAppointmentReport(
                doctorId,
                req.params.patientId,
                req.params.appointmentId,
                req.body ?? {}
            );
            res.status(200).json(report);
        } catch (error) {
            this.handleError(res, error, 'Trenutno nije moguće sačuvati izveštaj.');
        }
    }

    async getMonthSchedule(req: Request, res: Response): Promise<void> {
        const doctorId = (req as AuthenticatedRequest).doctorId;
        if (!doctorId) {
            res.status(401).json({ message: 'Niste prijavljeni.' });
            return;
        }

        try {
            const schedule = await this.portalService.getMonthSchedule(
                doctorId,
                req.query.year,
                req.query.month
            );
            res.status(200).json(schedule);
        } catch (error) {
            this.handleError(res, error, 'Trenutno nije moguće učitati raspored.');
        }
    }

    async markAppointmentNoShow(req: Request, res: Response): Promise<void> {
        const doctorId = (req as AuthenticatedRequest).doctorId;
        if (!doctorId) {
            res.status(401).json({ message: 'Niste prijavljeni.' });
            return;
        }

        try {
            const result = await this.portalService.markAppointmentNoShow(
                doctorId,
                req.params.appointmentId
            );
            res.status(200).json(result);
        } catch (error) {
            this.handleError(res, error, 'Trenutno nije moguće označiti nepojavljivanje.');
        }
    }

    async cancelAppointment(req: Request, res: Response): Promise<void> {
        const doctorId = (req as AuthenticatedRequest).doctorId;
        if (!doctorId) {
            res.status(401).json({ message: 'Niste prijavljeni.' });
            return;
        }

        try {
            const result = await this.portalService.cancelAppointment(doctorId, req.params.appointmentId);
            const appointment = result.appointment;
            const emailSent = await this.mailService.sendClinicCancellation(appointment.patientEmail, {
                patientFirstName: appointment.patientFirstName,
                serviceName: appointment.serviceName,
                doctorName: `dr ${appointment.doctorFirstName} ${appointment.doctorLastName}`,
                locationName: appointment.locationName,
                locationAddress: `${appointment.locationAddress}, ${appointment.locationCity}`,
                appointmentDateLabel: this.formatSerbianDate(appointment.appointmentDate),
                startTime: appointment.startTime
            });

            res.status(200).json({
                message: result.message,
                cancelled: true,
                emailSent,
                appointment: {
                    id: appointment.id,
                    status: appointment.status,
                    cancelledBy: appointment.cancelledBy
                }
            });
        } catch (error) {
            this.handleError(res, error, 'Pregled trenutno nije moguće otkazati.');
        }
    }

    private formatSerbianDate(isoDate: string): string {
        const [year, month, day] = isoDate.split('-').map(Number);
        return new Intl.DateTimeFormat('sr-Latn-RS', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC'
        }).format(new Date(Date.UTC(year, month - 1, day)));
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
