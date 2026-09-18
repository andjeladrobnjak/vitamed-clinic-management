import { Request, Response } from 'express';
import { MailService } from '../mail/mail.service';
import { AdminAppointmentService } from '../portal/admin-appointment.service';
import { AdminClinicServiceService } from '../portal/admin-clinic-service.service';
import { AdminDoctorAbsenceService } from '../portal/admin-doctor-absence.service';
import { AdminDoctorService } from '../portal/admin-doctor.service';
import { AdminPortalError, AdminPortalService } from '../portal/admin-portal.service';
import { AdminWeeklyScheduleService } from '../portal/admin-weekly-schedule.service';
import { AdminStatisticsService } from '../portal/admin-statistics.service';

export class AdminPortalController {
    constructor(
        private readonly portalService = new AdminPortalService(),
        private readonly doctorService = new AdminDoctorService(),
        private readonly clinicService = new AdminClinicServiceService(),
        private readonly appointmentService = new AdminAppointmentService(),
        private readonly absenceService = new AdminDoctorAbsenceService(),
        private readonly weeklyScheduleService = new AdminWeeklyScheduleService(),
        private readonly statisticsService = new AdminStatisticsService(),
        private readonly mailService = new MailService()
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

    async listDoctorAbsences(req: Request, res: Response): Promise<void> {
        try {
            const result = await this.absenceService.list(req.params.id);
            res.status(200).json(result);
        } catch (error) {
            this.handleError(res, error, 'Trenutno nije moguće učitati odsustva.');
        }
    }

    async createDoctorAbsence(req: Request, res: Response): Promise<void> {
        try {
            const absence = await this.absenceService.create(req.params.id, req.body ?? {});
            res.status(201).json(absence);
        } catch (error) {
            this.handleError(res, error, 'Trenutno nije moguće dodati odsustvo.');
        }
    }

    async deleteDoctorAbsence(req: Request, res: Response): Promise<void> {
        try {
            await this.absenceService.remove(req.params.id, req.params.absenceId);
            res.status(200).json({ message: 'Odsustvo je uspešno uklonjeno.' });
        } catch (error) {
            this.handleError(res, error, 'Trenutno nije moguće ukloniti odsustvo.');
        }
    }

    async createService(req: Request, res: Response): Promise<void> {
        try {
            const service = await this.clinicService.create(req.body);
            res.status(201).json(service);
        } catch (error) {
            this.handleError(res, error, 'Trenutno nije moguće dodati uslugu.');
        }
    }

    async updateService(req: Request, res: Response): Promise<void> {
        try {
            const service = await this.clinicService.update(Number(req.params.id), req.body);
            res.status(200).json(service);
        } catch (error) {
            this.handleError(res, error, 'Trenutno nije moguće sačuvati uslugu.');
        }
    }

    async getStatistics(req: Request, res: Response): Promise<void> {
        try {
            const statistics = await this.statisticsService.getStatistics(req.query.period);
            res.status(200).json(statistics);
        } catch (error) {
            this.handleError(res, error, 'Trenutno nije moguće učitati statistiku.');
        }
    }

    async getWeeklySchedule(req: Request, res: Response): Promise<void> {
        try {
            const schedule = await this.weeklyScheduleService.getWeek(req.query as Record<string, unknown>);
            res.status(200).json(schedule);
        } catch (error) {
            this.handleError(res, error, 'Trenutno nije moguće učitati raspored.');
        }
    }

    async listAppointments(req: Request, res: Response): Promise<void> {
        try {
            const result = await this.appointmentService.list(req.query as Record<string, unknown>);
            res.status(200).json(result);
        } catch (error) {
            this.handleError(res, error, 'Došlo je do greške pri učitavanju termina.');
        }
    }

    async cancelAppointment(req: Request, res: Response): Promise<void> {
        try {
            const result = await this.appointmentService.cancel(req.params.id);
            const mail = result.mail;
            const [year, month, day] = mail.appointmentDate.split('-').map(Number);
            const appointmentDateLabel = new Intl.DateTimeFormat('sr-Latn-RS', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                timeZone: 'UTC'
            }).format(new Date(Date.UTC(year, month - 1, day)));

            let emailSent = false;
            try {
                emailSent = await this.mailService.sendClinicCancellation(mail.patientEmail, {
                    patientFirstName: mail.patientFirstName,
                    serviceName: mail.serviceName,
                    doctorName: mail.doctorName,
                    locationName: mail.locationName,
                    locationAddress: `${mail.locationAddress}, ${mail.locationCity}`,
                    appointmentDateLabel,
                    startTime: mail.startTime
                });
            } catch {
                emailSent = false;
            }

            res.status(200).json({
                message: 'Termin je uspešno otkazan.',
                cancelled: true,
                emailSent,
                appointment: result.appointment
            });
        } catch (error) {
            this.handleError(res, error, 'Termin trenutno nije moguće otkazati.');
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
