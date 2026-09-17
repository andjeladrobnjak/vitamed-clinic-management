import { Router } from 'express';
import { AdminAuthController } from '../controllers/admin-auth.controller';
import { authenticateAdmin } from '../middleware/auth.middleware';

const adminAuthRouter = Router();
const adminAuthController = new AdminAuthController();

adminAuthRouter.post('/login', (req, res) => adminAuthController.login(req, res));
adminAuthRouter.get('/me', authenticateAdmin, (req, res) => adminAuthController.me(req, res));

export default adminAuthRouter;
