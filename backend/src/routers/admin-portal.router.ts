import { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer';
import { AdminPortalController } from '../controllers/admin-portal.controller';
import { authenticateAdmin } from '../middleware/auth.middleware';

const adminPortalRouter = Router();
const adminPortalController = new AdminPortalController();
const imageUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }
});

adminPortalRouter.get('/dashboard', authenticateAdmin, (req, res) =>
    adminPortalController.dashboard(req, res)
);
adminPortalRouter.post('/doctors', authenticateAdmin, (req, res) =>
    adminPortalController.createDoctor(req, res)
);
adminPortalRouter.get('/doctors/:id', authenticateAdmin, (req, res) =>
    adminPortalController.getDoctor(req, res)
);
adminPortalRouter.post(
    '/doctors/:id/image',
    authenticateAdmin,
    (req: Request, res: Response, next: NextFunction) => {
        imageUpload.single('image')(req, res, (error: unknown) => {
            if (!error) {
                next();
                return;
            }

            if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
                res.status(400).json({ message: 'Fotografija ne može biti veća od 5 MB.' });
                return;
            }

            res.status(400).json({ message: 'Fotografija nije ispravna.' });
        });
    },
    (req, res) => adminPortalController.uploadDoctorImage(req, res)
);
adminPortalRouter.put('/doctors/:id', authenticateAdmin, (req, res) =>
    adminPortalController.updateDoctor(req, res)
);
adminPortalRouter.get('/doctors/:id/absences', authenticateAdmin, (req, res) =>
    adminPortalController.listDoctorAbsences(req, res)
);
adminPortalRouter.post('/doctors/:id/absences', authenticateAdmin, (req, res) =>
    adminPortalController.createDoctorAbsence(req, res)
);
adminPortalRouter.delete('/doctors/:id/absences/:absenceId', authenticateAdmin, (req, res) =>
    adminPortalController.deleteDoctorAbsence(req, res)
);
adminPortalRouter.get('/doctors/:id/account', authenticateAdmin, (req, res) =>
    adminPortalController.getDoctorAccount(req, res)
);
adminPortalRouter.get('/doctors/:id/account/email-suggestion', authenticateAdmin, (req, res) =>
    adminPortalController.suggestDoctorAccountEmail(req, res)
);
adminPortalRouter.post('/doctors/:id/account/temporary-password', authenticateAdmin, (req, res) =>
    adminPortalController.generateDoctorTemporaryPassword(req, res)
);
adminPortalRouter.post('/doctors/:id/account', authenticateAdmin, (req, res) =>
    adminPortalController.createDoctorAccount(req, res)
);
adminPortalRouter.post('/doctors/:id/account/reset-password', authenticateAdmin, (req, res) =>
    adminPortalController.resetDoctorPassword(req, res)
);
adminPortalRouter.post('/services', authenticateAdmin, (req, res) =>
    adminPortalController.createService(req, res)
);
adminPortalRouter.put('/services/:id', authenticateAdmin, (req, res) =>
    adminPortalController.updateService(req, res)
);
adminPortalRouter.get('/statistics', authenticateAdmin, (req, res) =>
    adminPortalController.getStatistics(req, res)
);
adminPortalRouter.get('/schedule/eligible-doctors', authenticateAdmin, (req, res) =>
    adminPortalController.listEligibleExceptionDoctors(req, res)
);
adminPortalRouter.get('/schedule', authenticateAdmin, (req, res) =>
    adminPortalController.getWeeklySchedule(req, res)
);
adminPortalRouter.get('/doctors/:id/schedule-day', authenticateAdmin, (req, res) =>
    adminPortalController.getScheduleDay(req, res)
);
adminPortalRouter.put('/doctors/:id/schedule-exceptions/:date', authenticateAdmin, (req, res) =>
    adminPortalController.upsertScheduleException(req, res)
);
adminPortalRouter.delete('/doctors/:id/schedule-exceptions/:date', authenticateAdmin, (req, res) =>
    adminPortalController.deleteScheduleException(req, res)
);
adminPortalRouter.get('/patients/by-jmbg', authenticateAdmin, (req, res) =>
    adminPortalController.lookupPatientByJmbg(req, res)
);
adminPortalRouter.get('/appointments', authenticateAdmin, (req, res) =>
    adminPortalController.listAppointments(req, res)
);
adminPortalRouter.post('/appointments', authenticateAdmin, (req, res) =>
    adminPortalController.createAppointment(req, res)
);
adminPortalRouter.patch('/appointments/:id/cancel', authenticateAdmin, (req, res) =>
    adminPortalController.cancelAppointment(req, res)
);

export default adminPortalRouter;
