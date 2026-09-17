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

export default adminPortalRouter;
