import { Router } from 'express';
import { DoctorPortalController } from '../controllers/doctor-portal.controller';
import { authenticateDoctor, requireDoctorPortalAccess } from '../middleware/auth.middleware';

const doctorPortalRouter = Router();
const doctorPortalController = new DoctorPortalController();
const doctorPortalAuth = [authenticateDoctor, requireDoctorPortalAccess];

doctorPortalRouter.get('/dashboard', ...doctorPortalAuth, (req, res) =>
    doctorPortalController.dashboard(req, res)
);

doctorPortalRouter.post(
    '/appointments/:appointmentId/complete',
    ...doctorPortalAuth,
    (req, res) => doctorPortalController.completeAppointment(req, res)
);

doctorPortalRouter.get('/patients', ...doctorPortalAuth, (req, res) =>
    doctorPortalController.listPatients(req, res)
);

doctorPortalRouter.get('/patients/:patientId', ...doctorPortalAuth, (req, res) =>
    doctorPortalController.getPatient(req, res)
);

doctorPortalRouter.get(
    '/patients/:patientId/appointments/:appointmentId/report',
    ...doctorPortalAuth,
    (req, res) => doctorPortalController.getAppointmentReport(req, res)
);

doctorPortalRouter.put(
    '/patients/:patientId/appointments/:appointmentId/report',
    ...doctorPortalAuth,
    (req, res) => doctorPortalController.updateAppointmentReport(req, res)
);

doctorPortalRouter.get('/schedule', ...doctorPortalAuth, (req, res) =>
    doctorPortalController.getMonthSchedule(req, res)
);

doctorPortalRouter.patch(
    '/appointments/:appointmentId/no-show',
    ...doctorPortalAuth,
    (req, res) => doctorPortalController.markAppointmentNoShow(req, res)
);

doctorPortalRouter.patch(
    '/appointments/:appointmentId/cancel',
    ...doctorPortalAuth,
    (req, res) => doctorPortalController.cancelAppointment(req, res)
);

export default doctorPortalRouter;
