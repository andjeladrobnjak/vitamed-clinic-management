export const DOCTOR_RATINGS_JOIN = `LEFT JOIN (
    SELECT
        a.doctor_id AS doctorId,
        AVG(r.rating) AS averageRating,
        COUNT(r.id) AS reviewCount
    FROM doctor_reviews r
    INNER JOIN appointments a ON a.id = r.appointment_id
    GROUP BY a.doctor_id
) rating_stats ON rating_stats.doctorId = d.id`;

export interface DoctorRatingFields {
    averageRating: number | string | null;
    reviewCount: number | string | null;
}

export function mapDoctorRating(row: DoctorRatingFields): {
    averageRating: number | null;
    reviewCount: number;
} {
    const reviewCount = Number(row.reviewCount ?? 0);
    if (reviewCount <= 0 || row.averageRating === null || row.averageRating === undefined) {
        return {
            averageRating: null,
            reviewCount: 0
        };
    }

    return {
        averageRating: Math.round(Number(row.averageRating) * 10) / 10,
        reviewCount
    };
}
