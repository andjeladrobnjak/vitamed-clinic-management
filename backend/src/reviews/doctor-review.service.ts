import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../db/connection';
import { parsePositiveId } from '../availability/availability.logic';

export class DoctorReviewError extends Error {
    constructor(
        public readonly statusCode: number,
        message: string
    ) {
        super(message);
        this.name = 'DoctorReviewError';
    }
}

export interface DoctorReview {
    id: number;
    appointmentId: number;
    rating: number;
    comment: string | null;
    createdAt: string;
    updatedAt: string;
}

interface AppointmentRow extends RowDataPacket {
    id: number;
    patientId: number | null;
    doctorId: number;
    status: string;
}

interface ReviewRow extends RowDataPacket {
    id: number;
    appointmentId: number;
    patientId: number | null;
    rating: number;
    comment: string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
}

export class DoctorReviewService {
    async create(patientId: number, input: { appointmentId: unknown; rating: unknown; comment: unknown }): Promise<DoctorReview> {
        const appointmentId = parsePositiveId(input.appointmentId);
        if (!appointmentId) {
            throw new DoctorReviewError(400, 'Neispravan identifikator pregleda.');
        }

        const rating = this.parseRating(input.rating);
        const comment = this.parseComment(input.comment, true);

        const appointment = await this.findAppointment(appointmentId);
        if (!appointment) {
            throw new DoctorReviewError(404, 'Pregled nije pronađen.');
        }

        if (appointment.patientId !== patientId) {
            throw new DoctorReviewError(403, 'Ovaj pregled nije moguće oceniti.');
        }

        if (String(appointment.status) !== 'completed') {
            throw new DoctorReviewError(409, 'Ocena je moguća samo nakon obavljenog pregleda.');
        }

        if (!appointment.doctorId) {
            throw new DoctorReviewError(409, 'Ovaj pregled nije moguće oceniti.');
        }

        try {
            const [result] = await pool.query<ResultSetHeader>(
                `INSERT INTO doctor_reviews (appointment_id, rating, comment)
                 VALUES (?, ?, ?)`,
                [appointmentId, rating, comment]
            );

            return this.requireReview(result.insertId);
        } catch (error) {
            if (this.isDuplicateReview(error)) {
                throw new DoctorReviewError(409, 'Ovaj pregled je već ocenjen.');
            }
            throw error;
        }
    }

    async update(
        patientId: number,
        reviewId: number,
        input: { rating?: unknown; comment?: unknown }
    ): Promise<DoctorReview> {
        const review = await this.findReview(reviewId);
        if (!review) {
            throw new DoctorReviewError(404, 'Ocena nije pronađena.');
        }

        if (review.patientId !== patientId) {
            throw new DoctorReviewError(403, 'Ovu ocenu nije moguće izmeniti.');
        }

        const hasRating = Object.prototype.hasOwnProperty.call(input, 'rating');
        const hasComment = Object.prototype.hasOwnProperty.call(input, 'comment');

        if (!hasRating && !hasComment) {
            throw new DoctorReviewError(400, 'Potrebno je uneti ocenu ili komentar.');
        }

        const rating = hasRating ? this.parseRating(input.rating) : Number(review.rating);
        const comment = hasComment ? this.parseComment(input.comment, true) : review.comment;

        await pool.query(
            `UPDATE doctor_reviews
             SET rating = ?, comment = ?
             WHERE id = ?`,
            [rating, comment, reviewId]
        );

        return this.requireReview(reviewId);
    }

    async listPublicWrittenReviews(doctorId: number): Promise<Array<{
        id: number;
        rating: number;
        comment: string;
        createdAt: string;
        appointmentDate: string;
    }>> {
        const [rows] = await pool.query<(RowDataPacket & {
            id: number;
            rating: number;
            comment: string;
            createdAt: Date | string;
            appointmentDate: string;
        })[]>(
            `SELECT
                r.id,
                r.rating,
                r.comment,
                r.created_at AS createdAt,
                DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointmentDate
             FROM doctor_reviews r
             INNER JOIN appointments a ON a.id = r.appointment_id
             WHERE a.doctor_id = ?
               AND r.comment IS NOT NULL
               AND TRIM(r.comment) <> ''
             ORDER BY r.created_at DESC, r.id DESC`,
            [doctorId]
        );

        return rows.map((row) => ({
            id: Number(row.id),
            rating: Number(row.rating),
            comment: String(row.comment),
            createdAt: this.toIso(row.createdAt),
            appointmentDate: String(row.appointmentDate)
        }));
    }

    private async findAppointment(appointmentId: number): Promise<{
        id: number;
        patientId: number | null;
        doctorId: number;
        status: string;
    } | null> {
        const [rows] = await pool.query<AppointmentRow[]>(
            `SELECT
                id,
                patient_id AS patientId,
                doctor_id AS doctorId,
                status
             FROM appointments
             WHERE id = ?
             LIMIT 1`,
            [appointmentId]
        );

        const row = rows[0];
        if (!row) {
            return null;
        }

        return {
            id: Number(row.id),
            patientId: row.patientId === null ? null : Number(row.patientId),
            doctorId: Number(row.doctorId),
            status: String(row.status)
        };
    }

    private async findReview(reviewId: number): Promise<ReviewRow | null> {
        const [rows] = await pool.query<ReviewRow[]>(
            this.reviewSelect() + ' WHERE r.id = ? LIMIT 1',
            [reviewId]
        );
        return rows[0] ?? null;
    }

    private async requireReview(reviewId: number): Promise<DoctorReview> {
        const review = await this.findReview(reviewId);
        if (!review) {
            throw new DoctorReviewError(500, 'Ocenu trenutno nije moguće učitati.');
        }
        return this.mapReview(review);
    }

    private reviewSelect(): string {
        return `SELECT
                r.id,
                r.appointment_id AS appointmentId,
                a.patient_id AS patientId,
                r.rating,
                r.comment,
                r.created_at AS createdAt,
                r.updated_at AS updatedAt
             FROM doctor_reviews r
             INNER JOIN appointments a ON a.id = r.appointment_id`;
    }

    private mapReview(row: ReviewRow): DoctorReview {
        return {
            id: Number(row.id),
            appointmentId: Number(row.appointmentId),
            rating: Number(row.rating),
            comment: row.comment === null || row.comment === undefined ? null : String(row.comment),
            createdAt: this.toIso(row.createdAt),
            updatedAt: this.toIso(row.updatedAt)
        };
    }

    private parseRating(value: unknown): number {
        const rating = Number(value);
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            throw new DoctorReviewError(400, 'Ocena mora biti ceo broj od 1 do 5.');
        }
        return rating;
    }

    private parseComment(value: unknown, allowMissing: boolean): string | null {
        if (value === undefined || value === null) {
            return allowMissing ? null : null;
        }

        if (typeof value !== 'string') {
            throw new DoctorReviewError(400, 'Komentar nije ispravan.');
        }

        const comment = value.trim();
        if (!comment) {
            return null;
        }

        if (comment.length > 500) {
            throw new DoctorReviewError(400, 'Komentar može imati najviše 500 karaktera.');
        }

        return comment;
    }

    private toIso(value: Date | string): string {
        if (value instanceof Date) {
            return value.toISOString();
        }
        return String(value);
    }

    private isDuplicateReview(error: unknown): boolean {
        return typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'ER_DUP_ENTRY';
    }
}
