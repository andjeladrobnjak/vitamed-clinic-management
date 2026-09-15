import { Router } from 'express';
import { DoctorAuthController } from '../controllers/doctor-auth.controller';
import { authenticateDoctor } from '../middleware/auth.middleware';

const doctorAuthRouter = Router();
const doctorAuthController = new DoctorAuthController();

doctorAuthRouter.post('/login', (req, res) => doctorAuthController.login(req, res));
doctorAuthRouter.get('/me', authenticateDoctor, (req, res) => doctorAuthController.me(req, res));

export default doctorAuthRouter;
