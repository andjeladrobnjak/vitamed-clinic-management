import { Router } from 'express';
import { DoctorController } from '../controllers/doctor.controller';

const doctorRouter = Router();
const doctorController = new DoctorController();

doctorRouter.get('/', (req, res) => doctorController.list(req, res));
doctorRouter.get('/:id', (req, res) => doctorController.getById(req, res));

export default doctorRouter;
