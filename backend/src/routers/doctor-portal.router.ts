import { Router } from 'express';
import { DoctorPortalController } from '../controllers/doctor-portal.controller';
import { authenticateDoctor } from '../middleware/auth.middleware';

const doctorPortalRouter = Router();
const doctorPortalController = new DoctorPortalController();

doctorPortalRouter.get('/dashboard', authenticateDoctor, (req, res) =>
    doctorPortalController.dashboard(req, res)
);

export default doctorPortalRouter;
