import { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import pool from '../db/connection';
import {
    clinicClock,
    minutesToTimeLabel,
    normalizeTimeLabel,
    parsePositiveId,
    timeToMinutes,
    weekdayFromCalendarDate
} from '../availability/availability.logic';
import { AdminPortalError } from './admin-portal.service';
import { deleteManagedDoctorUpload, storeDoctorImage } from './doctor-image.service';

interface DoctorRow extends RowDataPacket {
    id: number;
    firstName: string;
    lastName: string;
    biography: string | null;
    education: string | null;
    professionalExperience: string | null;
    imageUrl: string | null;
    specialtyId: number;
    specialtyName: string;
}

interface LocationRow extends RowDataPacket {
    id: number;
    name: string;
    address: string;
    city: string;
    phone: string;
    workingHours: string;
}

interface ServiceRow extends RowDataPacket {
    id: number;
    name: string;
    description: string | null;
    price: number | string;
    durationMinutes: number;
}

interface ScheduleRow extends RowDataPacket {
    dayOfWeek: number;
    locationId: number;
    startTime: string;
    endTime: string;
}

interface FutureAppointmentRow extends RowDataPacket {
    appointmentDate: string;
    startTime: string;
    endTime: string;
    locationId: number;
}

interface IdRow extends RowDataPacket {
    id: number;
    specialtyId?: number;
}

export interface AdminDoctorSchedule {
    dayOfWeek: number;
    locationId: number;
    startTime: string;
    endTime: string;
}

export interface AdminDoctorDetail {
    id: number;
    firstName: string;
    lastName: string;
    biography: string | null;
    education: string | null;
    professionalExperience: string | null;
    imageUrl: string | null;
    specialty: { id: number; name: string };
    locations: { id: number; name: string; address: string; city: string; phone: string; workingHours: string }[];
    services: { id: number; name: string; description: string | null; price: number; durationMinutes: number }[];
    schedules: AdminDoctorSchedule[];
}

interface ParsedSchedule {
    dayOfWeek: number;
    locationId: number;
    startTime: string;
    endTime: string;
}

export class AdminDoctorService {
    async getById(id: number): Promise<AdminDoctorDetail> {
        if (!parsePositiveId(id)) {
            throw new AdminPortalError(404, 'Lekar nije pronađen.');
        }

        const doctor = await this.loadDoctor(id);
        if (!doctor) {
            throw new AdminPortalError(404, 'Lekar nije pronađen.');
        }

        return doctor;
    }

    async saveImage(id: number, mimeType: string | undefined, buffer: Buffer | undefined): Promise<{ imageUrl: string }> {
        if (!parsePositiveId(id)) {
            throw new AdminPortalError(404, 'Lekar nije pronađen.');
        }

        if (!buffer || !mimeType) {
            throw new AdminPortalError(400, 'Fotografija je obavezna.');
        }

        const doctor = await this.loadDoctor(id);
        if (!doctor) {
            throw new AdminPortalError(404, 'Lekar nije pronađen.');
        }

        const imageUrl = await storeDoctorImage(id, mimeType, buffer);
        return { imageUrl };
    }

    async create(body: unknown): Promise<AdminDoctorDetail> {
        const payload = this.parsePayload(body);
        if (payload.locationIds.length === 0) {
            throw new AdminPortalError(400, 'Izaberite najmanje jednu lokaciju na kojoj lekar radi.');
        }
        if (payload.serviceIds.length === 0) {
            throw new AdminPortalError(400, 'Izaberite najmanje jednu uslugu koju lekar pruža.');
        }

        const connection = await pool.getConnection();
        let doctorId = 0;

        try {
            await connection.beginTransaction();

            await this.assertSpecialty(connection, payload.specialtyId);
            await this.assertLocations(connection, payload.locationIds);
            await this.assertServices(connection, payload.serviceIds, payload.specialtyId);
            this.assertSchedules(payload.schedules, payload.locationIds);

            const [result] = await connection.query<ResultSetHeader>(
                `INSERT INTO doctors
                    (first_name, last_name, specialty_id, biography, education, professional_experience, image_url)
                 VALUES (?, ?, ?, ?, ?, ?, NULL)`,
                [
                    payload.firstName,
                    payload.lastName,
                    payload.specialtyId,
                    payload.biography,
                    payload.education,
                    payload.professionalExperience
                ]
            );

            doctorId = Number(result.insertId);
            if (!parsePositiveId(doctorId)) {
                throw new AdminPortalError(500, 'Trenutno nije moguće dodati lekara.');
            }

            await connection.query(
                `INSERT INTO doctor_locations (doctor_id, location_id) VALUES ${payload.locationIds
                    .map(() => '(?, ?)')
                    .join(', ')}`,
                payload.locationIds.flatMap((locationId) => [doctorId, locationId])
            );

            await connection.query(
                `INSERT INTO doctor_services (doctor_id, service_id) VALUES ${payload.serviceIds
                    .map(() => '(?, ?)')
                    .join(', ')}`,
                payload.serviceIds.flatMap((serviceId) => [doctorId, serviceId])
            );

            if (payload.schedules.length > 0) {
                await connection.query(
                    `INSERT INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
                     VALUES ${payload.schedules.map(() => '(?, ?, ?, ?, ?)').join(', ')}`,
                    payload.schedules.flatMap((schedule) => [
                        doctorId,
                        schedule.locationId,
                        schedule.dayOfWeek,
                        schedule.startTime,
                        schedule.endTime
                    ])
                );
            }

            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

        return this.getById(doctorId);
    }

    async update(id: number, body: unknown): Promise<AdminDoctorDetail> {
        if (!parsePositiveId(id)) {
            throw new AdminPortalError(404, 'Lekar nije pronađen.');
        }

        const payload = this.parsePayload(body);
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            const [doctorRows] = await connection.query<DoctorRow[]>(
                `SELECT d.id, d.image_url AS imageUrl
                 FROM doctors d
                 WHERE d.id = ?
                 LIMIT 1
                 FOR UPDATE`,
                [id]
            );

            if (!doctorRows[0]) {
                throw new AdminPortalError(404, 'Lekar nije pronađen.');
            }

            const previousImageUrl = doctorRows[0].imageUrl;

            await this.assertSpecialty(connection, payload.specialtyId);
            await this.assertLocations(connection, payload.locationIds);
            await this.assertServices(connection, payload.serviceIds, payload.specialtyId);
            this.assertSchedules(payload.schedules, payload.locationIds);
            await this.assertFutureAppointmentsFit(connection, id, payload.locationIds, payload.schedules);

            await connection.query(
                `UPDATE doctors
                 SET first_name = ?,
                     last_name = ?,
                     specialty_id = ?,
                     biography = ?,
                     education = ?,
                     professional_experience = ?,
                     image_url = ?
                 WHERE id = ?`,
                [
                    payload.firstName,
                    payload.lastName,
                    payload.specialtyId,
                    payload.biography,
                    payload.education,
                    payload.professionalExperience,
                    payload.imageUrl,
                    id
                ]
            );

            await connection.query('DELETE FROM doctor_locations WHERE doctor_id = ?', [id]);
            if (payload.locationIds.length > 0) {
                await connection.query(
                    `INSERT INTO doctor_locations (doctor_id, location_id) VALUES ${payload.locationIds
                        .map(() => '(?, ?)')
                        .join(', ')}`,
                    payload.locationIds.flatMap((locationId) => [id, locationId])
                );
            }

            await connection.query('DELETE FROM doctor_services WHERE doctor_id = ?', [id]);
            if (payload.serviceIds.length > 0) {
                await connection.query(
                    `INSERT INTO doctor_services (doctor_id, service_id) VALUES ${payload.serviceIds
                        .map(() => '(?, ?)')
                        .join(', ')}`,
                    payload.serviceIds.flatMap((serviceId) => [id, serviceId])
                );
            }

            await connection.query('DELETE FROM doctor_schedules WHERE doctor_id = ?', [id]);
            if (payload.schedules.length > 0) {
                await connection.query(
                    `INSERT INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
                     VALUES ${payload.schedules.map(() => '(?, ?, ?, ?, ?)').join(', ')}`,
                    payload.schedules.flatMap((schedule) => [
                        id,
                        schedule.locationId,
                        schedule.dayOfWeek,
                        schedule.startTime,
                        schedule.endTime
                    ])
                );
            }

            await connection.commit();
            if (previousImageUrl && previousImageUrl !== payload.imageUrl) {
                await deleteManagedDoctorUpload(previousImageUrl);
            }
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

        return this.getById(id);
    }

    private async loadDoctor(id: number): Promise<AdminDoctorDetail | null> {
        const [doctorRows] = await pool.query<DoctorRow[]>(
            `SELECT
                d.id,
                d.first_name AS firstName,
                d.last_name AS lastName,
                d.biography,
                d.education,
                d.professional_experience AS professionalExperience,
                d.image_url AS imageUrl,
                s.id AS specialtyId,
                s.name AS specialtyName
             FROM doctors d
             INNER JOIN specialties s ON s.id = d.specialty_id
             WHERE d.id = ?
             LIMIT 1`,
            [id]
        );

        const doctor = doctorRows[0];
        if (!doctor) {
            return null;
        }

        const [locationRows] = await pool.query<LocationRow[]>(
            `SELECT
                l.id,
                l.name,
                l.address,
                l.city,
                l.phone,
                l.working_hours AS workingHours
             FROM doctor_locations dl
             INNER JOIN locations l ON l.id = dl.location_id
             WHERE dl.doctor_id = ?
             ORDER BY l.id`,
            [id]
        );

        const [serviceRows] = await pool.query<ServiceRow[]>(
            `SELECT
                sv.id,
                sv.name,
                sv.description,
                sv.price,
                sv.duration_minutes AS durationMinutes
             FROM doctor_services ds
             INNER JOIN services sv ON sv.id = ds.service_id
             WHERE ds.doctor_id = ?
             ORDER BY sv.name`,
            [id]
        );

        const [scheduleRows] = await pool.query<ScheduleRow[]>(
            `SELECT
                day_of_week AS dayOfWeek,
                location_id AS locationId,
                TIME_FORMAT(start_time, '%H:%i') AS startTime,
                TIME_FORMAT(end_time, '%H:%i') AS endTime
             FROM doctor_schedules
             WHERE doctor_id = ?
             ORDER BY day_of_week`,
            [id]
        );

        return {
            id: Number(doctor.id),
            firstName: doctor.firstName,
            lastName: doctor.lastName,
            biography: doctor.biography,
            education: doctor.education,
            professionalExperience: doctor.professionalExperience,
            imageUrl: doctor.imageUrl,
            specialty: {
                id: Number(doctor.specialtyId),
                name: doctor.specialtyName
            },
            locations: locationRows.map((row) => ({
                id: Number(row.id),
                name: row.name,
                address: row.address,
                city: row.city,
                phone: row.phone,
                workingHours: row.workingHours
            })),
            services: serviceRows.map((row) => ({
                id: Number(row.id),
                name: row.name,
                description: row.description,
                price: Number(row.price),
                durationMinutes: Number(row.durationMinutes)
            })),
            schedules: scheduleRows.map((row) => ({
                dayOfWeek: Number(row.dayOfWeek),
                locationId: Number(row.locationId),
                startTime: String(row.startTime),
                endTime: String(row.endTime)
            }))
        };
    }

    private parsePayload(body: unknown): {
        firstName: string;
        lastName: string;
        specialtyId: number;
        imageUrl: string | null;
        biography: string | null;
        education: string | null;
        professionalExperience: string | null;
        locationIds: number[];
        serviceIds: number[];
        schedules: ParsedSchedule[];
    } {
        if (!body || typeof body !== 'object') {
            throw new AdminPortalError(400, 'Podaci o lekaru nisu ispravni.');
        }

        const data = body as Record<string, unknown>;
        const firstName = this.requiredName(data['firstName'], 'Ime je obavezno.');
        const lastName = this.requiredName(data['lastName'], 'Prezime je obavezno.');
        const specialtyId = parsePositiveId(data['specialtyId']);
        if (!specialtyId) {
            throw new AdminPortalError(400, 'Izabrana specijalizacija nije ispravna.');
        }

        return {
            firstName,
            lastName,
            specialtyId,
            imageUrl: this.optionalText(data['imageUrl'], 500),
            biography: this.optionalText(data['biography']),
            education: this.optionalText(data['education']),
            professionalExperience: this.optionalText(data['professionalExperience']),
            locationIds: this.uniqueIds(data['locationIds'], 'Jedna ili više izabranih lokacija nisu ispravne.'),
            serviceIds: this.uniqueIds(data['serviceIds'], 'Jedna ili više izabranih usluga nisu ispravne.'),
            schedules: this.parseSchedules(data['schedules'])
        };
    }

    private requiredName(value: unknown, message: string): string {
        if (typeof value !== 'string') {
            throw new AdminPortalError(400, message);
        }

        const trimmed = value.trim();
        if (!trimmed) {
            throw new AdminPortalError(400, message);
        }

        if (trimmed.length > 100) {
            throw new AdminPortalError(400, message);
        }

        return trimmed;
    }

    private optionalText(value: unknown, maxLength?: number): string | null {
        if (value === null || value === undefined) {
            return null;
        }

        if (typeof value !== 'string') {
            throw new AdminPortalError(400, 'Tekstualna polja nisu ispravna.');
        }

        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }

        if (maxLength && trimmed.length > maxLength) {
            throw new AdminPortalError(400, 'Uneti tekst je predugačak.');
        }

        return trimmed;
    }

    private uniqueIds(value: unknown, invalidMessage: string): number[] {
        if (value === undefined || value === null) {
            return [];
        }

        if (!Array.isArray(value)) {
            throw new AdminPortalError(400, invalidMessage);
        }

        const ids: number[] = [];
        for (const item of value) {
            const id = parsePositiveId(item);
            if (!id) {
                throw new AdminPortalError(400, invalidMessage);
            }
            if (!ids.includes(id)) {
                ids.push(id);
            }
        }

        return ids;
    }

    private parseSchedules(value: unknown): ParsedSchedule[] {
        if (value === undefined || value === null) {
            return [];
        }

        if (!Array.isArray(value)) {
            throw new AdminPortalError(400, 'Raspored rada nije ispravan.');
        }

        const schedules: ParsedSchedule[] = [];
        const days = new Set<number>();

        for (const item of value) {
            if (!item || typeof item !== 'object') {
                throw new AdminPortalError(400, 'Raspored rada nije ispravan.');
            }

            const row = item as Record<string, unknown>;
            const works = row['works'];
            if (works === false) {
                continue;
            }

            const dayOfWeek = Number(row['dayOfWeek']);
            if (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7) {
                throw new AdminPortalError(400, 'Dan u rasporedu nije ispravan.');
            }

            if (days.has(dayOfWeek)) {
                throw new AdminPortalError(400, 'Raspored može imati samo jednu smenu po danu.');
            }

            const locationId = parsePositiveId(row['locationId']);
            const startTime = typeof row['startTime'] === 'string' ? normalizeTimeLabel(row['startTime']) : null;
            const endTime = typeof row['endTime'] === 'string' ? normalizeTimeLabel(row['endTime']) : null;

            if (!startTime) {
                throw new AdminPortalError(400, 'Unesite vreme početka za svaki radni dan.');
            }

            if (!endTime) {
                throw new AdminPortalError(400, 'Unesite vreme završetka za svaki radni dan.');
            }

            if (!locationId) {
                throw new AdminPortalError(400, 'Za svaki radni dan izaberite lokaciju na kojoj lekar radi.');
            }

            if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
                throw new AdminPortalError(400, 'Vreme početka mora biti pre vremena završetka.');
            }

            days.add(dayOfWeek);
            schedules.push({
                dayOfWeek,
                locationId,
                startTime,
                endTime
            });
        }

        return schedules;
    }

    private assertSchedules(schedules: ParsedSchedule[], locationIds: number[]): void {
        for (const schedule of schedules) {
            if (!locationIds.includes(schedule.locationId)) {
                throw new AdminPortalError(
                    400,
                    'Lokacija u rasporedu mora biti među dodeljenim lokacijama lekara.'
                );
            }
        }
    }

    private async assertSpecialty(connection: PoolConnection, specialtyId: number): Promise<void> {
        const [rows] = await connection.query<IdRow[]>('SELECT id FROM specialties WHERE id = ? LIMIT 1', [
            specialtyId
        ]);
        if (!rows[0]) {
            throw new AdminPortalError(400, 'Izabrana specijalizacija nije ispravna.');
        }
    }

    private async assertLocations(connection: PoolConnection, locationIds: number[]): Promise<void> {
        if (locationIds.length === 0) {
            return;
        }

        const [rows] = await connection.query<IdRow[]>(
            `SELECT id FROM locations WHERE id IN (${locationIds.map(() => '?').join(', ')})`,
            locationIds
        );

        if (rows.length !== locationIds.length) {
            throw new AdminPortalError(400, 'Jedna ili više izabranih lokacija nisu ispravne.');
        }
    }

    private async assertServices(connection: PoolConnection, serviceIds: number[], specialtyId: number): Promise<void> {
        if (serviceIds.length === 0) {
            return;
        }

        const [rows] = await connection.query<IdRow[]>(
            `SELECT id, specialty_id AS specialtyId
             FROM services
             WHERE id IN (${serviceIds.map(() => '?').join(', ')})`,
            serviceIds
        );

        if (rows.length !== serviceIds.length) {
            throw new AdminPortalError(400, 'Jedna ili više izabranih usluga nisu ispravne.');
        }

        if (rows.some((row) => Number(row.specialtyId) !== specialtyId)) {
            throw new AdminPortalError(400, 'Sve usluge moraju pripadati izabranoj specijalizaciji.');
        }
    }

    private async assertFutureAppointmentsFit(
        connection: PoolConnection,
        doctorId: number,
        locationIds: number[],
        schedules: ParsedSchedule[]
    ): Promise<void> {
        const clock = clinicClock();
        const nowTime = minutesToTimeLabel(clock.minutes);
        const [rows] = await connection.query<FutureAppointmentRow[]>(
            `SELECT
                DATE_FORMAT(appointment_date, '%Y-%m-%d') AS appointmentDate,
                TIME_FORMAT(start_time, '%H:%i:%s') AS startTime,
                TIME_FORMAT(end_time, '%H:%i:%s') AS endTime,
                location_id AS locationId
             FROM appointments
             WHERE doctor_id = ?
               AND status = 'confirmed'
               AND TIMESTAMP(appointment_date, start_time) > TIMESTAMP(?, ?)`,
            [doctorId, clock.date, nowTime]
        );

        const byDay = new Map(schedules.map((schedule) => [schedule.dayOfWeek, schedule]));

        for (const row of rows) {
            const locationId = Number(row.locationId);
            if (!locationIds.includes(locationId)) {
                throw new AdminPortalError(
                    409,
                    'Raspored nije moguće sačuvati jer jedan ili više budućih zakazanih termina ne ulazi u novo radno vreme.'
                );
            }

            const weekday = weekdayFromCalendarDate(String(row.appointmentDate));
            const schedule = byDay.get(weekday);
            if (!schedule || schedule.locationId !== locationId) {
                throw new AdminPortalError(
                    409,
                    'Raspored nije moguće sačuvati jer jedan ili više budućih zakazanih termina ne ulazi u novo radno vreme.'
                );
            }

            const start = timeToMinutes(String(row.startTime));
            const end = timeToMinutes(String(row.endTime));
            const shiftStart = timeToMinutes(schedule.startTime);
            const shiftEnd = timeToMinutes(schedule.endTime);
            if (start < shiftStart || end > shiftEnd) {
                throw new AdminPortalError(
                    409,
                    'Raspored nije moguće sačuvati jer jedan ili više budućih zakazanih termina ne ulazi u novo radno vreme.'
                );
            }
        }
    }
}
