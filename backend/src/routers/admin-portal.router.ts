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
adminPortalRouter.post('/services', authenticateAdmin, (req, res) =>
    adminPortalController.createService(req, res)
);
adminPortalRouter.put('/services/:id', authenticateAdmin, (req, res) =>
    adminPortalController.updateService(req, res)
);
adminPortalRouter.get('/appointments', authenticateAdmin, (req, res) =>
    adminPortalController.listAppointments(req, res)
);
adminPortalRouter.patch('/appointments/:id/cancel', authenticateAdmin, (req, res) =>
    adminPortalController.cancelAppointment(req, res)
);

export default adminPortalRouter;
