import { Router } from 'express';
import { DoctorPortalController } from '../controllers/doctor-portal.controller';
import { authenticateDoctor } from '../middleware/auth.middleware';

const doctorPortalRouter = Router();
const doctorPortalController = new DoctorPortalController();

doctorPortalRouter.get('/dashboard', authenticateDoctor, (req, res) =>
    doctorPortalController.dashboard(req, res)
);

doctorPortalRouter.post(
    '/appointments/:appointmentId/complete',
    authenticateDoctor,
    (req, res) => doctorPortalController.completeAppointment(req, res)
);

doctorPortalRouter.get('/patients', authenticateDoctor, (req, res) =>
    doctorPortalController.listPatients(req, res)
);

doctorPortalRouter.get('/patients/:patientId', authenticateDoctor, (req, res) =>
    doctorPortalController.getPatient(req, res)
);

doctorPortalRouter.get(
    '/patients/:patientId/appointments/:appointmentId/report',
    authenticateDoctor,
    (req, res) => doctorPortalController.getAppointmentReport(req, res)
);

doctorPortalRouter.get('/schedule', authenticateDoctor, (req, res) =>
    doctorPortalController.getMonthSchedule(req, res)
);

export default doctorPortalRouter;
