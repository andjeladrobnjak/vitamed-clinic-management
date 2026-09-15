import { Router } from 'express';
import { AppointmentController } from '../controllers/appointment.controller';
import { optionalAuthenticatePatient } from '../middleware/auth.middleware';

const appointmentRouter = Router();
const appointmentController = new AppointmentController();

appointmentRouter.get('/availability', (req, res) =>
    appointmentController.availability(req, res)
);
appointmentRouter.get('/available-dates', (req, res) =>
    appointmentController.availableDates(req, res)
);
appointmentRouter.post('/', optionalAuthenticatePatient, (req, res) =>
    appointmentController.create(req, res)
);

export default appointmentRouter;
