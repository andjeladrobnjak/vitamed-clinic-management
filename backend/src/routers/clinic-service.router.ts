import { Router } from 'express';
import { ClinicServiceController } from '../controllers/clinic-service.controller';

const clinicServiceRouter = Router();
const clinicServiceController = new ClinicServiceController();

clinicServiceRouter.get('/', (req, res) => clinicServiceController.list(req, res));

export default clinicServiceRouter;
