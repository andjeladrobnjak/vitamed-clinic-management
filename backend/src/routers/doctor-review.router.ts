import { Router } from 'express';
import { DoctorReviewController } from '../controllers/doctor-review.controller';
import { authenticatePatient } from '../middleware/auth.middleware';

const doctorReviewRouter = Router();
const doctorReviewController = new DoctorReviewController();

doctorReviewRouter.post('/', authenticatePatient, (req, res) =>
    doctorReviewController.create(req, res)
);
doctorReviewRouter.patch('/:id', authenticatePatient, (req, res) =>
    doctorReviewController.update(req, res)
);

export default doctorReviewRouter;
