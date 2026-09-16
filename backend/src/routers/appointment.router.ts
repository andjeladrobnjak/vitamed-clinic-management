import { Router } from 'express';
import { AppointmentController } from '../controllers/appointment.controller';
import { authenticatePatient, optionalAuthenticatePatient } from '../middleware/auth.middleware';

const appointmentRouter = Router();
const appointmentController = new AppointmentController();

appointmentRouter.get('/availability', (req, res) =>
    appointmentController.availability(req, res)
);
appointmentRouter.get('/available-dates', (req, res) =>
    appointmentController.availableDates(req, res)
);
appointmentRouter.get('/upcoming/all', authenticatePatient, (req, res) =>
    appointmentController.upcomingAll(req, res)
);
appointmentRouter.get('/upcoming', authenticatePatient, (req, res) =>
    appointmentController.upcoming(req, res)
);
appointmentRouter.get('/history', authenticatePatient, (req, res) =>
    appointmentController.history(req, res)
);
appointmentRouter.get('/:id/report', authenticatePatient, (req, res) =>
    appointmentController.report(req, res)
);
appointmentRouter.post('/', optionalAuthenticatePatient, (req, res) =>
    appointmentController.create(req, res)
);
appointmentRouter.patch('/:id/cancel', authenticatePatient, (req, res) =>
    appointmentController.cancel(req, res)
);

export default appointmentRouter;
