import { Request, Response } from 'express';
import { parsePositiveId } from '../availability/availability.logic';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { DoctorReviewError, DoctorReviewService } from '../reviews/doctor-review.service';

export class DoctorReviewController {
    constructor(private readonly reviewService = new DoctorReviewService()) {}

    async create(req: Request, res: Response): Promise<void> {
        try {
            const patientId = (req as AuthenticatedRequest).patientId;
            if (!patientId) {
                res.status(401).json({ message: 'Niste prijavljeni.' });
                return;
            }

            const review = await this.reviewService.create(patientId, {
                appointmentId: req.body?.appointmentId,
                rating: req.body?.rating,
                comment: req.body?.comment
            });

            res.status(201).json(review);
        } catch (error) {
            this.handleError(res, error, 'Ocenu trenutno nije moguće sačuvati.');
        }
    }

    async update(req: Request, res: Response): Promise<void> {
        try {
            const patientId = (req as AuthenticatedRequest).patientId;
            const reviewId = parsePositiveId(req.params.id);

            if (!patientId) {
                res.status(401).json({ message: 'Niste prijavljeni.' });
                return;
            }

            if (!reviewId) {
                res.status(400).json({ message: 'Neispravan identifikator ocene.' });
                return;
            }

            const payload: { rating?: unknown; comment?: unknown } = {};
            if (Object.prototype.hasOwnProperty.call(req.body ?? {}, 'rating')) {
                payload.rating = req.body.rating;
            }
            if (Object.prototype.hasOwnProperty.call(req.body ?? {}, 'comment')) {
                payload.comment = req.body.comment;
            }

            const review = await this.reviewService.update(patientId, reviewId, payload);

            res.json(review);
        } catch (error) {
            this.handleError(res, error, 'Ocenu trenutno nije moguće izmeniti.');
        }
    }

    private handleError(res: Response, error: unknown, fallback: string): void {
        if (error instanceof DoctorReviewError) {
            res.status(error.statusCode).json({ message: error.message });
            return;
        }

        console.error('Greška pri radu sa ocenama lekara:', error);
        res.status(500).json({ message: fallback });
    }
}
