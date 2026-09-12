import { Router } from 'express';
import { PatientController } from '../controllers/patient.controller';

const patientRouter = Router();
const patientController = new PatientController();

patientRouter.post('/register', (req, res) => patientController.register(req, res));

export default patientRouter;
