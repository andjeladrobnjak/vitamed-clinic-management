import { RowDataPacket } from 'mysql2';
import pool from '../db/connection';
import { addCalendarDays, clinicClock } from '../availability/availability.logic';
import { AdminPortalError } from './admin-portal.service';

export const ADMIN_STATISTICS_PERIODS = ['thisMonth', 'thisYear', 'last12months'] as const;
export type AdminStatisticsPeriod = (typeof ADMIN_STATISTICS_PERIODS)[number];

const DEMAND_STATUSES = ['confirmed', 'completed'] as const;
const RATE_STATUSES = ['confirmed', 'completed', 'cancelled'] as const;
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec'];

export interface AdminStatisticsPopularDoctor {
    id: number;
    firstName: string;
    lastName: string;
    specialtyName: string;
    count: number;
}

export interface AdminStatisticsPopularService {
    id: number;
    name: string;
    specialtyName: string;
    count: number;
}

export interface AdminStatisticsCountPoint {
    key: string;
    label: string;
    count: number;
}

export interface AdminStatisticsRatePoint {
    key: string;
    label: string;
    percent: number;
    cancelled: number;
    total: number;
}

export interface AdminStatisticsNamedCount {
    id: number;
    name: string;
    count: number;
    percent: number;
}

export interface AdminStatistics {
    period: AdminStatisticsPeriod;
    popularDoctors: {
        thisMonth: AdminStatisticsPopularDoctor | null;
        allTime: AdminStatisticsPopularDoctor | null;
    };
    popularServices: {
        thisMonth: AdminStatisticsPopularService | null;
        allTime: AdminStatisticsPopularService | null;
    };
    completedTrend: {
        granularity: 'day' | 'month';
        points: AdminStatisticsCountPoint[];
    };
    specialtyDemand: AdminStatisticsNamedCount[];
    locationDemand: AdminStatisticsNamedCount[];
    cancellationTrend: {
        granularity: 'day' | 'month';
        points: AdminStatisticsRatePoint[];
    };
}

interface DoctorRow extends RowDataPacket {
    id: number;
    firstName: string;
    lastName: string;
    specialtyName: string;
    demandCount: number;
}

interface ServiceRow extends RowDataPacket {
    id: number;
    name: string;
    specialtyName: string;
    demandCount: number;
}

interface BucketCountRow extends RowDataPacket {
    bucket: string;
    total: number;
}

interface BucketRateRow extends RowDataPacket {
    bucket: string;
    cancelled: number;
    total: number;
}

interface NamedCountRow extends RowDataPacket {
    id: number;
    name: string;
    demandCount: number;
}

export class AdminStatisticsService {
    async getStatistics(periodInput: unknown): Promise<AdminStatistics> {
        const period = this.parsePeriod(periodInput);
        const today = clinicClock().date;
        const currentMonth = this.monthRange(today);
        const selectedRange = this.periodRange(period, today);
        const trend = this.trendSpec(period, today);

        const [
            doctorThisMonth,
            doctorAllTime,
            serviceThisMonth,
            serviceAllTime,
            completedRows,
            cancellationRows,
            specialtyRows,
            locationRows
        ] = await Promise.all([
            this.topDoctor(currentMonth.from, currentMonth.to),
            this.topDoctor(null, null),
            this.topService(currentMonth.from, currentMonth.to),
            this.topService(null, null),
            this.completedCounts(trend.granularity, trend.from, trend.to),
            this.cancellationBuckets(trend.granularity, trend.from, trend.to),
            this.specialtyDemand(selectedRange.from, selectedRange.to),
            this.locationDemand(selectedRange.from, selectedRange.to)
        ]);

        const trendKeys = this.buildTrendKeys(period, today);
        const completedMap = new Map(completedRows.map((row) => [row.bucket, Number(row.total)]));
        const cancellationMap = new Map(
            cancellationRows.map((row) => [row.bucket, { cancelled: Number(row.cancelled), total: Number(row.total) }])
        );

        return {
            period,
            popularDoctors: {
                thisMonth: doctorThisMonth,
                allTime: doctorAllTime
            },
            popularServices: {
                thisMonth: serviceThisMonth,
                allTime: serviceAllTime
            },
            completedTrend: {
                granularity: trend.granularity,
                points: trendKeys.map((point) => ({
                    key: point.key,
                    label: point.label,
                    count: completedMap.get(point.key) ?? 0
                }))
            },
            specialtyDemand: this.withPercents(specialtyRows),
            locationDemand: this.withPercents(locationRows),
            cancellationTrend: {
                granularity: trend.granularity,
                points: trendKeys.map((point) => {
                    const bucket = cancellationMap.get(point.key);
                    const cancelled = bucket?.cancelled ?? 0;
                    const total = bucket?.total ?? 0;
                    return {
                        key: point.key,
                        label: point.label,
                        percent: total === 0 ? 0 : (cancelled / total) * 100,
                        cancelled,
                        total
                    };
                })
            }
        };
    }

    private parsePeriod(value: unknown): AdminStatisticsPeriod {
        const period = String(value ?? 'last12months');
        if ((ADMIN_STATISTICS_PERIODS as readonly string[]).includes(period)) {
            return period as AdminStatisticsPeriod;
        }
        throw new AdminPortalError(400, 'Period nije ispravan.');
    }

    private async topDoctor(from: string | null, to: string | null): Promise<AdminStatisticsPopularDoctor | null> {
        const [rows] = await pool.query<DoctorRow[]>(
            `SELECT
                d.id,
                d.first_name AS firstName,
                d.last_name AS lastName,
                s.name AS specialtyName,
                COUNT(*) AS demandCount
             FROM appointments a
             INNER JOIN doctors d ON d.id = a.doctor_id
             INNER JOIN specialties s ON s.id = d.specialty_id
             WHERE a.status IN (${this.sqlList(DEMAND_STATUSES)})
               ${this.dateClause(from, to)}
             GROUP BY d.id, d.first_name, d.last_name, s.name
             ORDER BY demandCount DESC, d.last_name ASC, d.first_name ASC, d.id ASC
             LIMIT 1`,
            this.dateParams(from, to)
        );
        const row = rows[0];
        if (!row) {
            return null;
        }
        return {
            id: Number(row.id),
            firstName: String(row.firstName),
            lastName: String(row.lastName),
            specialtyName: String(row.specialtyName),
            count: Number(row.demandCount)
        };
    }

    private async topService(from: string | null, to: string | null): Promise<AdminStatisticsPopularService | null> {
        const [rows] = await pool.query<ServiceRow[]>(
            `SELECT
                sv.id,
                sv.name,
                sp.name AS specialtyName,
                COUNT(*) AS demandCount
             FROM appointments a
             INNER JOIN services sv ON sv.id = a.service_id
             INNER JOIN specialties sp ON sp.id = sv.specialty_id
             WHERE a.status IN (${this.sqlList(DEMAND_STATUSES)})
               ${this.dateClause(from, to)}
             GROUP BY sv.id, sv.name, sp.name
             ORDER BY demandCount DESC, sv.name ASC, sv.id ASC
             LIMIT 1`,
            this.dateParams(from, to)
        );
        const row = rows[0];
        if (!row) {
            return null;
        }
        return {
            id: Number(row.id),
            name: String(row.name),
            specialtyName: String(row.specialtyName),
            count: Number(row.demandCount)
        };
    }

    private async completedCounts(
        granularity: 'day' | 'month',
        from: string | null,
        to: string | null
    ): Promise<{ bucket: string; total: number }[]> {
        const format = granularity === 'day' ? '%Y-%m-%d' : '%Y-%m';
        const [rows] = await pool.query<BucketCountRow[]>(
            `SELECT DATE_FORMAT(a.appointment_date, '${format}') AS bucket, COUNT(*) AS total
             FROM appointments a
             WHERE a.status = 'completed'
               ${this.dateClause(from, to)}
             GROUP BY bucket
             ORDER BY bucket ASC`,
            this.dateParams(from, to)
        );
        return rows.map((row) => ({ bucket: String(row.bucket), total: Number(row.total) }));
    }

    private async cancellationBuckets(
        granularity: 'day' | 'month',
        from: string | null,
        to: string | null
    ): Promise<{ bucket: string; cancelled: number; total: number }[]> {
        const format = granularity === 'day' ? '%Y-%m-%d' : '%Y-%m';
        const [rows] = await pool.query<BucketRateRow[]>(
            `SELECT
                DATE_FORMAT(a.appointment_date, '${format}') AS bucket,
                SUM(a.status = 'cancelled') AS cancelled,
                COUNT(*) AS total
             FROM appointments a
             WHERE a.status IN (${this.sqlList(RATE_STATUSES)})
               ${this.dateClause(from, to)}
             GROUP BY bucket
             ORDER BY bucket ASC`,
            this.dateParams(from, to)
        );
        return rows.map((row) => ({
            bucket: String(row.bucket),
            cancelled: Number(row.cancelled),
            total: Number(row.total)
        }));
    }

    private async specialtyDemand(from: string | null, to: string | null): Promise<NamedCountRow[]> {
        const [rows] = await pool.query<NamedCountRow[]>(
            `SELECT
                sp.id,
                sp.name,
                COUNT(a.id) AS demandCount
             FROM specialties sp
             LEFT JOIN services sv ON sv.specialty_id = sp.id
             LEFT JOIN appointments a
                ON a.service_id = sv.id
               AND a.status IN (${this.sqlList(DEMAND_STATUSES)})
               ${this.dateClause(from, to, 'a')}
             GROUP BY sp.id, sp.name
             ORDER BY demandCount DESC, sp.name ASC, sp.id ASC`,
            this.dateParams(from, to)
        );
        return rows;
    }

    private async locationDemand(from: string | null, to: string | null): Promise<NamedCountRow[]> {
        const [rows] = await pool.query<NamedCountRow[]>(
            `SELECT
                l.id,
                l.name,
                COUNT(a.id) AS demandCount
             FROM locations l
             LEFT JOIN appointments a
                ON a.location_id = l.id
               AND a.status IN (${this.sqlList(DEMAND_STATUSES)})
               ${this.dateClause(from, to, 'a')}
             GROUP BY l.id, l.name
             ORDER BY demandCount DESC, l.name ASC, l.id ASC`,
            this.dateParams(from, to)
        );
        return rows;
    }

    private withPercents(rows: NamedCountRow[]): AdminStatisticsNamedCount[] {
        const items = rows.map((row) => ({
            id: Number(row.id),
            name: String(row.name),
            count: Number(row.demandCount)
        }));
        const total = items.reduce((sum, item) => sum + item.count, 0);
        return items.map((item) => ({
            ...item,
            percent: total === 0 ? 0 : (item.count / total) * 100
        }));
    }

    private periodRange(period: AdminStatisticsPeriod, today: string): { from: string; to: string } {
        if (period === 'thisMonth') {
            return this.monthRange(today);
        }
        if (period === 'thisYear') {
            const year = today.slice(0, 4);
            return { from: `${year}-01-01`, to: `${year}-12-31` };
        }
        const end = this.monthRange(today);
        const startMonth = this.shiftMonth(today, -11);
        return { from: `${startMonth}-01`, to: end.to };
    }

    private trendSpec(
        period: AdminStatisticsPeriod,
        today: string
    ): { granularity: 'day' | 'month'; from: string; to: string } {
        if (period === 'thisMonth') {
            const range = this.monthRange(today);
            return { granularity: 'day', from: range.from, to: range.to };
        }
        if (period === 'thisYear') {
            const year = today.slice(0, 4);
            const currentMonth = this.monthRange(today);
            return { granularity: 'month', from: `${year}-01-01`, to: currentMonth.to };
        }
        return { granularity: 'month', ...this.periodRange('last12months', today) };
    }

    private buildTrendKeys(
        period: AdminStatisticsPeriod,
        today: string
    ): { key: string; label: string }[] {
        if (period === 'thisMonth') {
            const range = this.monthRange(today);
            const keys: { key: string; label: string }[] = [];
            let current = range.from;
            while (current <= range.to) {
                keys.push({
                    key: current,
                    label: `${current.slice(8, 10)}.${current.slice(5, 7)}.`
                });
                current = addCalendarDays(current, 1);
            }
            return keys;
        }

        if (period === 'thisYear') {
            const year = Number(today.slice(0, 4));
            const currentMonth = Number(today.slice(5, 7));
            return this.monthKeys(`${year}-01`, `${year}-${String(currentMonth).padStart(2, '0')}`);
        }

        return this.monthKeys(this.shiftMonth(today, -11), today.slice(0, 7));
    }

    private monthKeys(fromYm: string, toYm: string): { key: string; label: string }[] {
        const keys: { key: string; label: string }[] = [];
        let year = Number(fromYm.slice(0, 4));
        let month = Number(fromYm.slice(5, 7));
        const endYear = Number(toYm.slice(0, 4));
        const endMonth = Number(toYm.slice(5, 7));
        while (year < endYear || (year === endYear && month <= endMonth)) {
            const key = `${year}-${String(month).padStart(2, '0')}`;
            keys.push({ key, label: `${MONTH_LABELS[month - 1]} ${year}` });
            month += 1;
            if (month === 13) {
                month = 1;
                year += 1;
            }
        }
        return keys;
    }

    private monthRange(isoDate: string): { from: string; to: string } {
        const year = Number(isoDate.slice(0, 4));
        const month = Number(isoDate.slice(5, 7));
        const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
        return {
            from: `${year}-${String(month).padStart(2, '0')}-01`,
            to: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
        };
    }

    private shiftMonth(isoDate: string, delta: number): string {
        const year = Number(isoDate.slice(0, 4));
        const month = Number(isoDate.slice(5, 7));
        const index = year * 12 + (month - 1) + delta;
        const nextYear = Math.floor(index / 12);
        const nextMonth = (index % 12) + 1;
        return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
    }

    private dateClause(from: string | null, to: string | null, alias = 'a'): string {
        if (from && to) {
            return `AND ${alias}.appointment_date BETWEEN ? AND ?`;
        }
        return '';
    }

    private dateParams(from: string | null, to: string | null): string[] {
        if (from && to) {
            return [from, to];
        }
        return [];
    }

    private sqlList(values: readonly string[]): string {
        return values.map((value) => `'${value}'`).join(', ');
    }
}
