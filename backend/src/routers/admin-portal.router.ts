import { Router } from 'express';
import { AdminPortalController } from '../controllers/admin-portal.controller';
import { authenticateAdmin } from '../middleware/auth.middleware';

const adminPortalRouter = Router();
const adminPortalController = new AdminPortalController();

adminPortalRouter.get('/dashboard', authenticateAdmin, (req, res) =>
    adminPortalController.dashboard(req, res)
);

export default adminPortalRouter;
