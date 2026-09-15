import { Router } from 'express';
import { SpecialtyController } from '../controllers/specialty.controller';

const specialtyRouter = Router();
const specialtyController = new SpecialtyController();

specialtyRouter.get('/', (req, res) => specialtyController.list(req, res));
specialtyRouter.get('/:slug', (req, res) => specialtyController.getBySlug(req, res));

export default specialtyRouter;
