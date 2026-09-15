import { Router } from 'express';
import { LocationController } from '../controllers/location.controller';

const locationRouter = Router();
const locationController = new LocationController();

locationRouter.get('/', (req, res) => locationController.list(req, res));

export default locationRouter;
