import { Router } from 'express';
import { PatientController } from '../controllers/patient.controller';
import { authenticatePatient } from '../middleware/auth.middleware';

const patientRouter = Router();
const patientController = new PatientController();

patientRouter.post('/register', (req, res) => patientController.register(req, res));
patientRouter.post('/login', (req, res) => patientController.login(req, res));
patientRouter.get('/me', authenticatePatient, (req, res) => patientController.me(req, res));

export default patientRouter;
