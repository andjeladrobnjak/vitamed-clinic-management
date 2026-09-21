import { Request, Response } from 'express';
import { AppointmentBookingService } from '../appointments/appointment-booking.service';
import { ISO_DATE_PATTERN } from '../availability/availability.constants';
import { isIsoDate } from '../availability/availability.logic';
import {
    AvailabilityContextError,
    AvailabilityService,
    parsePositiveId
} from '../availability/availability.service';
import { MailService } from '../mail/mail.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export class AppointmentController {
    constructor(
        private readonly availabilityService = new AvailabilityService(),
        private readonly bookingService = new AppointmentBookingService(),
        private readonly mailService = new MailService()
    ) {}

    async availability(req: Request, res: Response): Promise<void> {
        try {
            const doctorId = parsePositiveId(req.query.doctorId);
            const serviceId = parsePositiveId(req.query.serviceId);
            const locationId = parsePositiveId(req.query.locationId);
            const date = typeof req.query.date === 'string' ? req.query.date : '';

            if (!doctorId || !serviceId || !locationId || !ISO_DATE_PATTERN.test(date) || !isIsoDate(date)) {
                res.status(400).json({
                    message: 'Potrebni su ispravni doctorId, serviceId, locationId i date.'
                });
                return;
            }

            const result = await this.availabilityService.getAvailableTimes({
                doctorId,
                serviceId,
                locationId,
                date
            });

            res.json(result);
        } catch (error) {
            this.handleError(res, error, 'Trenutno nije moguće učitati termine.');
        }
    }

    async availableDates(req: Request, res: Response): Promise<void> {
        try {
            const doctorId = parsePositiveId(req.query.doctorId);
            const serviceId = parsePositiveId(req.query.serviceId);
            const locationId = parsePositiveId(req.query.locationId);
            const from = typeof req.query.from === 'string' ? req.query.from : '';
            const to = typeof req.query.to === 'string' ? req.query.to : '';

            if (
                !doctorId ||
                !serviceId ||
                !locationId ||
                !ISO_DATE_PATTERN.test(from) ||
                !ISO_DATE_PATTERN.test(to) ||
                !isIsoDate(from) ||
                !isIsoDate(to)
            ) {
                res.status(400).json({
                    message: 'Potrebni su ispravni doctorId, serviceId, locationId, from i to.'
                });
                return;
            }

            const result = await this.availabilityService.getAvailableDates({
                doctorId,
                serviceId,
                locationId,
                from,
                to
            });

            res.json(result);
        } catch (error) {
            this.handleError(res, error, 'Trenutno nije moguće učitati dostupne datume.');
        }
    }

    async create(req: Request, res: Response): Promise<void> {
        try {
            const authenticatedPatientId = (req as AuthenticatedRequest).patientId ?? null;
            const appointment = await this.bookingService.create({
                ...req.body,
                authenticatedPatientId,
                bookedByAdmin: false
            });

            console.log(`[MAIL] Appointment ${appointment.id} committed; sending confirmation email`);

            const emailSent = await this.mailService.sendAppointmentConfirmation(appointment.email, {
                patientFirstName: appointment.patientFirstName,
                serviceName: appointment.service.name,
                doctorName: `dr ${appointment.doctor.firstName} ${appointment.doctor.lastName}`,
                locationName: appointment.location.name,
                locationAddress: `${appointment.location.address}, ${appointment.location.city}`,
                locationPhone: appointment.location.phone,
                appointmentDateLabel: this.formatSerbianDate(appointment.appointmentDate),
                startTime: appointment.startTime,
                durationMinutes: appointment.durationMinutes,
                isRegistered: appointment.registered
            });

            res.status(201).json({
                id: appointment.id,
                status: appointment.status,
                appointmentDate: appointment.appointmentDate,
                startTime: appointment.startTime,
                endTime: appointment.endTime,
                durationMinutes: appointment.durationMinutes,
                email: appointment.email,
                registered: appointment.registered,
                emailSent,
                service: appointment.service,
                doctor: appointment.doctor,
                location: appointment.location
            });
        } catch (error) {
            this.handleError(res, error, 'Došlo je do problema prilikom zakazivanja pregleda. Pokušajte ponovo.');
        }
    }

    async upcoming(req: Request, res: Response): Promise<void> {
        try {
            const patientId = (req as AuthenticatedRequest).patientId;
            if (!patientId) {
                res.status(401).json({ message: 'Niste prijavljeni.' });
                return;
            }

            const appointment = await this.bookingService.getUpcoming(patientId);
            res.json({ appointment });
        } catch (error) {
            this.handleError(res, error, 'Trenutno nije moguće učitati predstojeći pregled.');
        }
    }

    async upcomingAll(req: Request, res: Response): Promise<void> {
        try {
            const patientId = (req as AuthenticatedRequest).patientId;
            if (!patientId) {
                res.status(401).json({ message: 'Niste prijavljeni.' });
                return;
            }

            const appointments = await this.bookingService.listUpcoming(patientId);
            res.json({ appointments });
        } catch (error) {
            this.handleError(res, error, 'Trenutno nije moguće učitati predstojeće preglede.');
        }
    }

    async history(req: Request, res: Response): Promise<void> {
        try {
            const patientId = (req as AuthenticatedRequest).patientId;
            if (!patientId) {
                res.status(401).json({ message: 'Niste prijavljeni.' });
                return;
            }

            const appointments = await this.bookingService.listHistory(patientId);
            res.json({ appointments });
        } catch (error) {
            this.handleError(res, error, 'Trenutno nije moguće učitati istoriju pregleda.');
        }
    }

    async report(req: Request, res: Response): Promise<void> {
        try {
            const patientId = (req as AuthenticatedRequest).patientId;
            if (!patientId) {
                res.status(401).json({ message: 'Niste prijavljeni.' });
                return;
            }

            const report = await this.bookingService.getReport(patientId, req.params.id);
            res.json(report);
        } catch (error) {
            this.handleError(res, error, 'Trenutno nije moguće učitati izveštaj.');
        }
    }

    async cancel(req: Request, res: Response): Promise<void> {
        try {
            const patientId = (req as AuthenticatedRequest).patientId;
            const appointmentId = parsePositiveId(req.params.id);

            if (!patientId) {
                res.status(401).json({ message: 'Niste prijavljeni.' });
                return;
            }

            if (!appointmentId) {
                res.status(400).json({ message: 'Neispravan identifikator pregleda.' });
                return;
            }

            await this.bookingService.cancel(patientId, appointmentId);
            res.json({ cancelled: true });
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
        if (error instanceof AvailabilityContextError) {
            res.status(error.statusCode).json({ message: error.message });
            return;
        }

        console.error('Greška pri zakazivanju ili učitavanju dostupnosti:', error);
        res.status(500).json({ message: fallback });
    }
}
