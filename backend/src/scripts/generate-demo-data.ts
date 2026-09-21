import bcrypt from 'bcrypt';
import { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import pool from '../db/connection';
import {
    addCalendarDays,
    clinicClock,
    compareIsoDates,
    eachDateInclusive,
    formatUtcDate,
    generateShiftStartMinutes,
    intervalsOverlap,
    minutesToTimeLabel,
    normalizeTimeLabel,
    timeToMinutes,
    weekdayFromCalendarDate,
    type TimeInterval
} from '../availability/availability.logic';
import { BCRYPT_ROUNDS } from '../auth/doctor-password';
import {
    resolveEffectiveSchedule,
    type ScheduleAbsenceReason,
    type ScheduleShift
} from '../schedule/effective-schedule';

const DEMO_EMAIL_DOMAIN = 'demo.vitamed.rs';
const DEMO_PASSWORD = 'Demo1234!';
const DEMO_PATIENT_EMAIL = `milena.radojevic@${DEMO_EMAIL_DOMAIN}`;
const HISTORY_DAYS = 365;
const FUTURE_DAYS = 28;
const TARGET_MIN = 250;

const PATIENT_NAMES: Array<[string, string]> = [
    ['Milena', 'Radojević'],
    ['Petar', 'Gajić'],
    ['Jovana', 'Simić'],
    ['Nenad', 'Vuković'],
    ['Tamara', 'Obradović'],
    ['Bojan', 'Lazarević'],
    ['Irena', 'Mitić'],
    ['Dušan', 'Pavlović'],
    ['Sanja', 'Janković'],
    ['Vladimir', 'Stanković'],
    ['Maja', 'Đurić'],
    ['Stefan', 'Bogdanović'],
    ['Kristina', 'Aleksić'],
    ['Goran', 'Todorović'],
    ['Nataša', 'Mladenović'],
    ['Ilija', 'Živković'],
    ['Danijela', 'Cvetković'],
    ['Marko', 'Radović'],
    ['Bojana', 'Nikolić'],
    ['Aleksa', 'Savić'],
    ['Teodora', 'Ilić'],
    ['Uroš', 'Popović'],
    ['Anđela', 'Kostić'],
    ['Filip', 'Jović'],
    ['Milica', 'Ristić'],
    ['Lazar', 'Milić'],
    ['Katarina', 'Vasić'],
    ['Nikola', 'Petrović'],
    ['Sara', 'Lukić'],
    ['Vuk', 'Marinković'],
    ['Helena', 'Stojanović'],
    ['Andrija', 'Nešić'],
    ['Isidora', 'Babić'],
    ['Mihajlo', 'Kovačević'],
    ['Nadja', 'Filipović'],
    ['Ognjen', 'Tomić'],
    ['Vera', 'Đorđević'],
    ['Branko', 'Milosavljević'],
    ['Olga', 'Radovanović'],
    ['Željko', 'Antonijević']
];

const GUEST_NAMES: Array<[string, string]> = [
    ['Goran', 'Belić'],
    ['Snežana', 'Rakić'],
    ['Dejan', 'Veselinović'],
    ['Biljana', 'Manojlović'],
    ['Zoran', 'Krstić'],
    ['Ljiljana', 'Simović'],
    ['Predrag', 'Nenadović'],
    ['Slavica', 'Đukić']
];

const REVIEW_COMMENTS = [
    'Pregled je bio temeljan, a lekar je sve jasno objasnio.',
    'Ljubazno osoblje i kratko čekanje. Zadovoljna sam.',
    'Dobio sam konkretan savet i plan kontrole.',
    'Sve je proteklo profesionalno i bez žurbe.',
    'Klinika deluje organizovano, preporučila bih je.',
    'Lekar je bio strpljiv i pažljiv prema detaljima.',
    'Termin je počeo na vreme, nalaz je jasan.',
    'Odličan pristup, osećao sam se sigurno.',
    'Malo duže čekanje, ali pregled je bio kvalitetan.',
    'Kratak i efikasan pregled, hvala.',
    'Objašnjenje terapije bilo je razumljivo.',
    'Vrlo korektan odnos i jasne preporuke.'
];

const REPORTS = [
    {
        anamnesis: 'Pacijent navodi umor i povremenu nelagodnost tokom poslednjih nedelja.',
        findings: 'Objektivni nalaz uredan. Vitalni parametri u referentnim granicama.',
        diagnosis: 'Stanje posle kontrolnog pregleda, bez akutnih komplikacija.',
        therapy: 'Savetovan režim rada i odmora. Kontrolni pregled po potrebi.'
    },
    {
        anamnesis: 'Dolazi zbog kontrole prethodno ustanovljenog nalaza.',
        findings: 'Lokalni status bez značajnijih promena u odnosu na prethodni pregled.',
        diagnosis: 'Stabilan klinički nalaz.',
        therapy: 'Nastaviti postojeće mere. Javiti se ako se tegobe pojačaju.'
    },
    {
        anamnesis: 'Tegobe blagog intenziteta, bez noćnog pogoršanja.',
        findings: 'Pregledom nije nađeno akutno patološko odstupanje.',
        diagnosis: 'Funkcionalne tegobe.',
        therapy: 'Simptomatska terapija po potrebi i kontrola za mesec dana.'
    },
    {
        anamnesis: 'Pacijent traži ocenu trenutnog stanja pre planirane kontrole.',
        findings: 'Klinicki pregled uredan, bez znakova hitnosti.',
        diagnosis: 'Uredan nalaz.',
        therapy: 'Opšte mere prevencije. Sledeća kontrola po rasporedu.'
    }
];

interface CatalogDoctor {
    id: number;
    firstName: string;
    lastName: string;
    specialtyId: number;
    specialtyName: string;
    services: CatalogService[];
    locationIds: Set<number>;
    regularByDay: Map<number, ScheduleShift>;
}

interface CatalogService {
    id: number;
    name: string;
    durationMinutes: number;
    specialtyId: number;
}

interface CatalogLocation {
    id: number;
    name: string;
}

interface AbsenceRow {
    doctorId: number;
    startDate: string;
    endDate: string;
    reason: ScheduleAbsenceReason;
}

interface ExceptionRow {
    doctorId: number;
    date: string;
    startTime: string;
    endTime: string;
    locationId: number;
}

interface PlannedPatient {
    firstName: string;
    lastName: string;
    jmbg: string;
    email: string;
    phone: string;
}

interface PlannedAppointment {
    patientIndex: number | null;
    guestIndex: number | null;
    doctorId: number;
    serviceId: number;
    locationId: number;
    date: string;
    startTime: string;
    endTime: string;
    status: 'confirmed' | 'completed' | 'cancelled';
    cancelledBy: 'patient' | 'doctor' | 'admin' | null;
    firstName: string;
    lastName: string;
    jmbg: string;
    email: string;
    phone: string;
}

function fail(message: string): never {
    throw new Error(message);
}

function mix(seed: number, value: string): number {
    let hash = seed >>> 0;
    for (let index = 0; index < value.length; index += 1) {
        hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
    }
    return hash >>> 0;
}

function pickInt(seed: number, value: string, maxExclusive: number): number {
    if (maxExclusive <= 0) {
        return 0;
    }
    return mix(seed, value) % maxExclusive;
}

function chance(seed: number, value: string, percent: number): boolean {
    return pickInt(seed, value, 100) < percent;
}

function monthKey(isoDate: string): string {
    return isoDate.slice(0, 7);
}

function monthVolume(isoDate: string): number {
    const month = Number(isoDate.slice(5, 7));
    const curve = [0.88, 0.92, 1.08, 1.12, 1.04, 0.96, 0.78, 0.74, 1.06, 1.14, 1.1, 0.9];
    return curve[month - 1] ?? 1;
}

function slugPart(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/đ/g, 'dj')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z]/g, '');
}

function demoJmbg(index: number, guest = false): string {
    const day = String(1 + (index % 28)).padStart(2, '0');
    const month = String(1 + (index % 12)).padStart(2, '0');
    const yearDigits = String(970 + (index % 20)).padStart(3, '0');
    const serial = String((guest ? 800000 : 700000) + index).padStart(6, '0');
    return `${day}${month}${yearDigits}${serial}`;
}

function demoPhone(index: number): string {
    const prefix = 60 + (index % 9);
    const mid = String(200 + index).padStart(3, '0');
    const last = String(4000 + index).padStart(4, '0');
    return `+381 ${prefix} ${mid} ${last}`;
}

function nextWeekdayOnOrAfter(from: string, weekday: number, offsetWeeks = 0): string {
    let current = addCalendarDays(from, offsetWeeks * 7);
    for (let step = 0; step < 8; step += 1) {
        if (weekdayFromCalendarDate(current) === weekday) {
            return current;
        }
        current = addCalendarDays(current, 1);
    }
    return from;
}

function overlapsDate(start: string, end: string, date: string): boolean {
    return compareIsoDates(start, date) <= 0 && compareIsoDates(date, end) <= 0;
}

function asTimeLabel(value: unknown): string {
    const normalized = normalizeTimeLabel(String(value ?? ''));
    if (!normalized) {
        fail('Neispravno vreme u rasporedu lekara.');
    }
    return normalized;
}

async function loadCatalog(): Promise<{
    doctors: CatalogDoctor[];
    locations: CatalogLocation[];
    services: CatalogService[];
}> {
    const [doctorRows] = await pool.query<(RowDataPacket & {
        id: number;
        firstName: string;
        lastName: string;
        specialtyId: number;
        specialtyName: string;
    })[]>(
        `SELECT d.id, d.first_name AS firstName, d.last_name AS lastName,
                s.id AS specialtyId, s.name AS specialtyName
         FROM doctors d
         INNER JOIN specialties s ON s.id = d.specialty_id
         ORDER BY d.id`
    );
    const [serviceRows] = await pool.query<(RowDataPacket & {
        id: number;
        name: string;
        durationMinutes: number;
        specialtyId: number;
    })[]>(
        `SELECT id, name, duration_minutes AS durationMinutes, specialty_id AS specialtyId
         FROM services ORDER BY id`
    );
    const [locationRows] = await pool.query<(RowDataPacket & { id: number; name: string })[]>(
        'SELECT id, name FROM locations ORDER BY id'
    );
    const [scheduleRows] = await pool.query<(RowDataPacket & {
        doctorId: number;
        locationId: number;
        locationName: string;
        dayOfWeek: number;
        startTime: string;
        endTime: string;
    })[]>(
        `SELECT sc.doctor_id AS doctorId, sc.location_id AS locationId, l.name AS locationName,
                sc.day_of_week AS dayOfWeek, TIME_FORMAT(sc.start_time, '%H:%i') AS startTime,
                TIME_FORMAT(sc.end_time, '%H:%i') AS endTime
         FROM doctor_schedules sc
         INNER JOIN locations l ON l.id = sc.location_id`
    );
    const [serviceLinks] = await pool.query<(RowDataPacket & { doctorId: number; serviceId: number })[]>(
        'SELECT doctor_id AS doctorId, service_id AS serviceId FROM doctor_services'
    );
    const [locationLinks] = await pool.query<(RowDataPacket & { doctorId: number; locationId: number })[]>(
        'SELECT doctor_id AS doctorId, location_id AS locationId FROM doctor_locations'
    );

    if (!doctorRows.length) {
        fail('Nedostaju lekari. Prvo učitajte backend/database/seed.sql.');
    }
    if (!locationRows.length) {
        fail('Nedostaju lokacije. Prvo učitajte backend/database/seed.sql.');
    }
    if (!serviceRows.length) {
        fail('Nedostaju usluge. Prvo učitajte backend/database/seed.sql.');
    }
    if (!scheduleRows.length) {
        fail('Nedostaju rasporedi lekara. Prvo učitajte backend/database/seed.sql.');
    }
    if (!serviceLinks.length) {
        fail('Nedostaju veze lekar-usluga. Prvo učitajte backend/database/seed.sql.');
    }

    const services = serviceRows.map((row) => ({
        id: Number(row.id),
        name: String(row.name),
        durationMinutes: Number(row.durationMinutes),
        specialtyId: Number(row.specialtyId)
    }));
    const serviceById = new Map(services.map((service) => [service.id, service]));
    const locations = locationRows.map((row) => ({ id: Number(row.id), name: String(row.name) }));

    const doctors: CatalogDoctor[] = doctorRows.map((row) => ({
        id: Number(row.id),
        firstName: String(row.firstName),
        lastName: String(row.lastName),
        specialtyId: Number(row.specialtyId),
        specialtyName: String(row.specialtyName),
        services: [],
        locationIds: new Set<number>(),
        regularByDay: new Map<number, ScheduleShift>()
    }));
    const doctorById = new Map(doctors.map((doctor) => [doctor.id, doctor]));

    for (const link of serviceLinks) {
        const doctor = doctorById.get(Number(link.doctorId));
        const service = serviceById.get(Number(link.serviceId));
        if (doctor && service) {
            doctor.services.push(service);
        }
    }
    for (const link of locationLinks) {
        doctorById.get(Number(link.doctorId))?.locationIds.add(Number(link.locationId));
    }
    for (const row of scheduleRows) {
        const doctor = doctorById.get(Number(row.doctorId));
        if (!doctor) {
            continue;
        }
        doctor.regularByDay.set(Number(row.dayOfWeek), {
            startTime: asTimeLabel(row.startTime),
            endTime: asTimeLabel(row.endTime),
            location: { id: Number(row.locationId), name: String(row.locationName) }
        });
    }

    const usable = doctors.filter((doctor) => doctor.services.length > 0 && doctor.regularByDay.size > 0);
    if (!usable.length) {
        fail('Nijedan lekar nema i usluge i raspored. Prvo učitajte seed.sql.');
    }
    return { doctors: usable, locations, services };
}

function findDoctor(doctors: CatalogDoctor[], firstName: string, lastName: string): CatalogDoctor | undefined {
    return doctors.find((doctor) => doctor.firstName === firstName && doctor.lastName === lastName);
}

async function ensureLedgerTable(): Promise<void> {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS demo_data_ledger (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            entity_type VARCHAR(32) NOT NULL,
            entity_id BIGINT NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_demo_data_ledger (entity_type, entity_id)
        )
    `);
}

async function cleanupDemoData(connection: PoolConnection): Promise<void> {
    const emailLike = `%@${DEMO_EMAIL_DOMAIN}`;
    await connection.query(
        `DELETE r FROM appointment_reports r
         INNER JOIN appointments a ON a.id = r.appointment_id
         WHERE a.patient_email LIKE ?`,
        [emailLike]
    );
    await connection.query(
        `DELETE r FROM doctor_reviews r
         INNER JOIN appointments a ON a.id = r.appointment_id
         WHERE a.patient_email LIKE ?`,
        [emailLike]
    );
    await connection.query('DELETE FROM appointments WHERE patient_email LIKE ?', [emailLike]);
    await connection.query('DELETE FROM patients WHERE email LIKE ?', [emailLike]);
    await connection.query(
        `DELETE a FROM doctor_absences a
         INNER JOIN demo_data_ledger l ON l.entity_type = 'absence' AND l.entity_id = a.id`
    );
    await connection.query(
        `DELETE e FROM doctor_schedule_exceptions e
         INNER JOIN demo_data_ledger l ON l.entity_type = 'exception' AND l.entity_id = e.id`
    );
    await connection.query('DELETE FROM demo_data_ledger');
}

async function loadOperationalState(connection: PoolConnection): Promise<{
    absences: AbsenceRow[];
    exceptions: ExceptionRow[];
    blocking: Map<string, TimeInterval[]>;
}> {
    const [absenceRows] = await connection.query<(RowDataPacket & {
        doctorId: number;
        startDate: string;
        endDate: string;
        reason: string;
    })[]>(
        `SELECT doctor_id AS doctorId,
                DATE_FORMAT(start_date, '%Y-%m-%d') AS startDate,
                DATE_FORMAT(end_date, '%Y-%m-%d') AS endDate,
                reason
         FROM doctor_absences`
    );
    const [exceptionRows] = await connection.query<(RowDataPacket & {
        doctorId: number;
        date: string;
        startTime: string;
        endTime: string;
        locationId: number;
    })[]>(
        `SELECT doctor_id AS doctorId,
                DATE_FORMAT(exception_date, '%Y-%m-%d') AS date,
                TIME_FORMAT(start_time, '%H:%i') AS startTime,
                TIME_FORMAT(end_time, '%H:%i') AS endTime,
                location_id AS locationId
         FROM doctor_schedule_exceptions`
    );
    const [appointmentRows] = await connection.query<(RowDataPacket & {
        doctorId: number;
        date: string;
        startTime: string;
        endTime: string;
    })[]>(
        `SELECT doctor_id AS doctorId,
                DATE_FORMAT(appointment_date, '%Y-%m-%d') AS date,
                TIME_FORMAT(start_time, '%H:%i') AS startTime,
                TIME_FORMAT(end_time, '%H:%i') AS endTime
         FROM appointments
         WHERE status IN ('confirmed', 'completed')`
    );

    const absences = absenceRows.map((row) => ({
        doctorId: Number(row.doctorId),
        startDate: String(row.startDate),
        endDate: String(row.endDate),
        reason: (row.reason === 'annual_leave' || row.reason === 'sick_leave' || row.reason === 'day_off'
            ? row.reason
            : 'other') as ScheduleAbsenceReason
    }));
    const exceptions = exceptionRows.map((row) => ({
        doctorId: Number(row.doctorId),
        date: String(row.date),
        startTime: asTimeLabel(row.startTime),
        endTime: asTimeLabel(row.endTime),
        locationId: Number(row.locationId)
    }));
    const blocking = new Map<string, TimeInterval[]>();
    for (const row of appointmentRows) {
        const key = `${Number(row.doctorId)}:${String(row.date)}`;
        const list = blocking.get(key) ?? [];
        list.push({
            startMinutes: timeToMinutes(asTimeLabel(row.startTime)),
            endMinutes: timeToMinutes(asTimeLabel(row.endTime))
        });
        blocking.set(key, list);
    }
    return { absences, exceptions, blocking };
}

function effectiveFor(
    doctor: CatalogDoctor,
    date: string,
    absences: AbsenceRow[],
    exceptions: ExceptionRow[],
    locations: CatalogLocation[]
) {
    const absentRow = absences.find((row) => row.doctorId === doctor.id && overlapsDate(row.startDate, row.endDate, date));
    const exceptionRow = exceptions.find((row) => row.doctorId === doctor.id && row.date === date);
    const weekday = weekdayFromCalendarDate(date);
    const regular = doctor.regularByDay.get(weekday) ?? null;
    const exception = exceptionRow
        ? {
            startTime: exceptionRow.startTime,
            endTime: exceptionRow.endTime,
            location: {
                id: exceptionRow.locationId,
                name: locations.find((location) => location.id === exceptionRow.locationId)?.name ?? 'Lokacija'
            }
        }
        : null;
    return resolveEffectiveSchedule({
        date,
        weekday,
        absent: Boolean(absentRow),
        absenceReason: absentRow?.reason ?? null,
        regular,
        exception
    });
}

function hasAbsenceConflict(absences: AbsenceRow[], doctorId: number, start: string, end: string): boolean {
    return absences.some((row) =>
        row.doctorId === doctorId && compareIsoDates(row.startDate, end) <= 0 && compareIsoDates(start, row.endDate) <= 0
    );
}

function hasExceptionConflict(exceptions: ExceptionRow[], doctorId: number, start: string, end: string): boolean {
    return exceptions.some((row) =>
        row.doctorId === doctorId && compareIsoDates(start, row.date) <= 0 && compareIsoDates(row.date, end) <= 0
    );
}

function existingFitsShift(
    blocking: Map<string, TimeInterval[]>,
    doctorId: number,
    date: string,
    startTime: string,
    endTime: string
): boolean {
    const items = blocking.get(`${doctorId}:${date}`) ?? [];
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    return items.every((item) => item.startMinutes >= startMinutes && item.endMinutes <= endMinutes);
}

function planAbsences(doctors: CatalogDoctor[], today: string, existing: AbsenceRow[]): AbsenceRow[] {
    const planned: AbsenceRow[] = [];
    const add = (doctor: CatalogDoctor | undefined, start: string, end: string, reason: ScheduleAbsenceReason) => {
        if (!doctor) {
            return;
        }
        if (hasAbsenceConflict([...existing, ...planned], doctor.id, start, end)) {
            return;
        }
        planned.push({ doctorId: doctor.id, startDate: start, endDate: end, reason });
    };

    add(findDoctor(doctors, 'Stefan', 'Nikolić'), addCalendarDays(today, -80), addCalendarDays(today, -76), 'annual_leave');
    add(findDoctor(doctors, 'Luka', 'Savić'), addCalendarDays(today, -21), addCalendarDays(today, -20), 'sick_leave');
    add(findDoctor(doctors, 'Katarina', 'Pavlović'), nextWeekdayOnOrAfter(addCalendarDays(today, 10), 1), addCalendarDays(nextWeekdayOnOrAfter(addCalendarDays(today, 10), 1), 2), 'annual_leave');
    add(findDoctor(doctors, 'Ivana', 'Ristić'), nextWeekdayOnOrAfter(addCalendarDays(today, 5), 5), nextWeekdayOnOrAfter(addCalendarDays(today, 5), 5), 'day_off');
    add(findDoctor(doctors, 'Marko', 'Vasić'), addCalendarDays(today, -41), addCalendarDays(today, -41), 'other');
    return planned;
}

function planExceptions(
    doctors: CatalogDoctor[],
    locations: CatalogLocation[],
    today: string,
    absences: AbsenceRow[],
    existing: ExceptionRow[],
    blocking: Map<string, TimeInterval[]>
): ExceptionRow[] {
    const planned: ExceptionRow[] = [];
    const tryAdd = (
        doctor: CatalogDoctor | undefined,
        date: string,
        startTime: string,
        endTime: string,
        locationId: number
    ) => {
        if (!doctor || planned.length >= 6) {
            return;
        }
        if (existing.some((row) => row.doctorId === doctor.id && row.date === date)) {
            return;
        }
        if (planned.some((row) => row.doctorId === doctor.id && row.date === date)) {
            return;
        }
        if (!doctor.locationIds.has(locationId)) {
            return;
        }
        if (hasAbsenceConflict(absences, doctor.id, date, date) || hasExceptionConflict(existing, doctor.id, date, date)) {
            return;
        }
        if (!existingFitsShift(blocking, doctor.id, date, startTime, endTime)) {
            return;
        }
        planned.push({ doctorId: doctor.id, date, startTime, endTime, locationId });
    };

    const aleksandar = findDoctor(doctors, 'Aleksandar', 'Petrović');
    const vuk = findDoctor(doctors, 'Vuk', 'Đukić');
    const teodora = findDoctor(doctors, 'Teodora', 'Milić');
    const jelena = findDoctor(doctors, 'Jelena', 'Marković');
    const viktor = findDoctor(doctors, 'Viktor', 'Stanković');
    const mina = findDoctor(doctors, 'Mina', 'Radosavljević');

    const nextMonday = nextWeekdayOnOrAfter(addCalendarDays(today, 1), 1);
    const nextTuesday = nextWeekdayOnOrAfter(addCalendarDays(today, 1), 2);
    const nextThursday = nextWeekdayOnOrAfter(addCalendarDays(today, 1), 4);
    const nextWednesday = nextWeekdayOnOrAfter(addCalendarDays(today, 1), 3);
    const thisOrNextSaturday = nextWeekdayOnOrAfter(today, 6);

    if (aleksandar?.regularByDay.get(1)?.location.id) {
        tryAdd(aleksandar, nextMonday, '14:00', '20:00', aleksandar.regularByDay.get(1)!.location.id);
    }
    if (vuk) {
        const otherLocation = [...vuk.locationIds].find((id) => id !== vuk.regularByDay.get(2)?.location.id);
        if (otherLocation) {
            tryAdd(vuk, nextTuesday, '08:00', '14:00', otherLocation);
        }
    }
    if (teodora && teodora.locationIds.has(1)) {
        tryAdd(teodora, nextThursday, '09:00', '14:00', 1);
    }
    if (jelena?.regularByDay.get(3)) {
        tryAdd(jelena, nextWednesday, '14:00', '20:00', jelena.regularByDay.get(3)!.location.id);
    }
    if (viktor?.regularByDay.get(6) && viktor.locationIds.has(2)) {
        tryAdd(viktor, thisOrNextSaturday, '14:00', '19:00', 2);
    }
    if (mina?.regularByDay.get(6) && planned.length < 6) {
        tryAdd(mina, addCalendarDays(thisOrNextSaturday, 7), '09:00', '15:00', mina.regularByDay.get(6)!.location.id);
    }

    void locations;
    return planned;
}

function pickService(
    doctor: CatalogDoctor,
    date: string,
    today: string,
    preferredAllTimeId: number | null,
    preferredMonthId: number | null,
    token: string
): CatalogService {
    const currentMonth = monthKey(date) === monthKey(today);
    const preferred = currentMonth ? preferredMonthId : preferredAllTimeId;
    if (preferred && doctor.services.some((service) => service.id === preferred) && chance(21, token, 78)) {
        return doctor.services.find((service) => service.id === preferred) as CatalogService;
    }
    return doctor.services[pickInt(22, token, doctor.services.length)];
}

function takeSlot(
    doctor: CatalogDoctor,
    service: CatalogService,
    date: string,
    absences: AbsenceRow[],
    exceptions: ExceptionRow[],
    locations: CatalogLocation[],
    blocking: Map<string, TimeInterval[]>,
    token: string,
    future: boolean,
    earliestStartMinutes: number | null = null
): { startTime: string; endTime: string; locationId: number } | null {
    const resolution = effectiveFor(doctor, date, absences, exceptions, locations);
    if (!resolution.effective) {
        return null;
    }
    const startMinutes = timeToMinutes(resolution.effective.startTime);
    const endMinutes = timeToMinutes(resolution.effective.endTime);
    const candidates = generateShiftStartMinutes(startMinutes, endMinutes, service.durationMinutes);
    const occupied = blocking.get(`${doctor.id}:${date}`) ?? [];
    const free = candidates.filter((start) => {
        if (earliestStartMinutes !== null && start < earliestStartMinutes) {
            return false;
        }
        const interval = { startMinutes: start, endMinutes: start + service.durationMinutes };
        return !occupied.some((item) => intervalsOverlap(item, interval));
    });
    if (!free.length) {
        return null;
    }
    const stride = future ? Math.max(3, Math.floor(free.length / 3)) : Math.max(2, Math.floor(free.length / 5));
    const offset = pickInt(31, token, Math.max(1, stride));
    const chosen = free.filter((_, index) => (index - offset) % stride === 0);
    const start = (chosen.length ? chosen : free)[pickInt(32, token, chosen.length || free.length)];
    return {
        startTime: minutesToTimeLabel(start),
        endTime: minutesToTimeLabel(start + service.durationMinutes),
        locationId: resolution.effective.location.id
    };
}

function occupy(
    blocking: Map<string, TimeInterval[]>,
    doctorId: number,
    date: string,
    startTime: string,
    endTime: string
): void {
    const key = `${doctorId}:${date}`;
    const list = blocking.get(key) ?? [];
    list.push({ startMinutes: timeToMinutes(startTime), endMinutes: timeToMinutes(endTime) });
    blocking.set(key, list);
}

function statusFor(
    date: string,
    startTime: string,
    today: string,
    nowMinutes: number,
    token: string
): PlannedAppointment['status'] {
    if (compareIsoDates(date, today) > 0) {
        return 'confirmed';
    }
    if (compareIsoDates(date, today) < 0) {
        return chance(41, token, 12) ? 'cancelled' : 'completed';
    }
    const endMinutes = timeToMinutes(startTime);
    if (endMinutes + 15 <= nowMinutes) {
        return chance(42, token, 10) ? 'cancelled' : 'completed';
    }
    return 'confirmed';
}

function assignPerson(
    patients: PlannedPatient[],
    token: string,
    forcePatientIndex: number | null
): Pick<PlannedAppointment, 'patientIndex' | 'guestIndex' | 'firstName' | 'lastName' | 'jmbg' | 'email' | 'phone'> {
    if (forcePatientIndex !== null) {
        const patient = patients[forcePatientIndex];
        return {
            patientIndex: forcePatientIndex,
            guestIndex: null,
            firstName: patient.firstName,
            lastName: patient.lastName,
            jmbg: patient.jmbg,
            email: patient.email,
            phone: patient.phone
        };
    }
    if (chance(51, token, 20)) {
        const guestIndex = pickInt(52, token, GUEST_NAMES.length);
        const [firstName, lastName] = GUEST_NAMES[guestIndex];
        return {
            patientIndex: null,
            guestIndex,
            firstName,
            lastName,
            jmbg: demoJmbg(900 + guestIndex, true),
            email: `gost.${slugPart(firstName)}.${slugPart(lastName)}@${DEMO_EMAIL_DOMAIN}`,
            phone: demoPhone(200 + guestIndex)
        };
    }
    const patientIndex = pickInt(53, token, patients.length);
    const patient = patients[patientIndex];
    return {
        patientIndex,
        guestIndex: null,
        firstName: patient.firstName,
        lastName: patient.lastName,
        jmbg: patient.jmbg,
        email: patient.email,
        phone: patient.phone
    };
}

function pushAppointment(
    list: PlannedAppointment[],
    blocking: Map<string, TimeInterval[]>,
    item: Omit<PlannedAppointment, 'cancelledBy'> & { cancelledBy?: PlannedAppointment['cancelledBy'] }
): boolean {
    const key = `${item.doctorId}:${item.date}:${item.startTime}:${item.serviceId}:${item.email}`;
    if (list.some((existing) =>
        existing.doctorId === item.doctorId
        && existing.date === item.date
        && existing.startTime === item.startTime
    )) {
        return false;
    }
    list.push({
        ...item,
        cancelledBy: item.status === 'cancelled'
            ? (['patient', 'doctor', 'admin'] as const)[pickInt(61, key, 3)]
            : null
    });
    if (item.status !== 'cancelled') {
        occupy(blocking, item.doctorId, item.date, item.startTime, item.endTime);
    }
    return true;
}

function tryPlace(
    list: PlannedAppointment[],
    doctor: CatalogDoctor,
    date: string,
    today: string,
    nowMinutes: number,
    patients: PlannedPatient[],
    absences: AbsenceRow[],
    exceptions: ExceptionRow[],
    locations: CatalogLocation[],
    blocking: Map<string, TimeInterval[]>,
    preferredAllTimeId: number | null,
    preferredMonthId: number | null,
    token: string,
    forcePatientIndex: number | null = null,
    forceStatus?: PlannedAppointment['status']
): boolean {
    const service = pickService(doctor, date, today, preferredAllTimeId, preferredMonthId, token);
    const future = compareIsoDates(date, today) > 0;
    const earliest = date === today && forceStatus === 'confirmed' ? nowMinutes + 5 : null;
    const slot = takeSlot(doctor, service, date, absences, exceptions, locations, blocking, token, future, earliest);
    if (!slot) {
        return false;
    }
    if (future && timeToMinutes(slot.startTime) < 0) {
        return false;
    }
    const status = forceStatus ?? statusFor(date, slot.startTime, today, nowMinutes, token);
    if (status === 'completed' && (compareIsoDates(date, today) > 0 || (date === today && timeToMinutes(slot.startTime) >= nowMinutes))) {
        return false;
    }
    if (status === 'confirmed' && date === today && timeToMinutes(slot.startTime) + service.durationMinutes <= nowMinutes) {
        return false;
    }
    const person = assignPerson(patients, token, forcePatientIndex);
    return pushAppointment(list, blocking, {
        ...person,
        doctorId: doctor.id,
        serviceId: service.id,
        locationId: slot.locationId,
        date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        status
    });
}

function doctorWeight(doctorId: number, date: string, today: string, allTimeId: number, monthId: number): number {
    const currentMonth = monthKey(date) === monthKey(today);
    if (currentMonth && doctorId === monthId) {
        return 1.55;
    }
    if (!currentMonth && doctorId === allTimeId) {
        return 1.32;
    }
    if (currentMonth && doctorId === allTimeId) {
        return 0.72;
    }
    if (!currentMonth && doctorId === monthId) {
        return 0.78;
    }
    return 1;
}

function buildPatients(): PlannedPatient[] {
    return PATIENT_NAMES.map(([firstName, lastName], index) => ({
        firstName,
        lastName,
        jmbg: demoJmbg(index),
        email: index === 0
            ? DEMO_PATIENT_EMAIL
            : `${slugPart(firstName)}.${slugPart(lastName)}${index}@${DEMO_EMAIL_DOMAIN}`,
        phone: demoPhone(index)
    }));
}

function planAppointments(input: {
    doctors: CatalogDoctor[];
    locations: CatalogLocation[];
    patients: PlannedPatient[];
    absences: AbsenceRow[];
    exceptions: ExceptionRow[];
    blocking: Map<string, TimeInterval[]>;
    today: string;
    nowMinutes: number;
}): PlannedAppointment[] {
    const { doctors, locations, patients, absences, exceptions, blocking, today, nowMinutes } = input;
    const start = addCalendarDays(today, -HISTORY_DAYS);
    const end = addCalendarDays(today, FUTURE_DAYS);
    const dates = eachDateInclusive(start, end);
    const list: PlannedAppointment[] = [];

    const vuk = findDoctor(doctors, 'Vuk', 'Đukić') ?? doctors[0];
    const filip = findDoctor(doctors, 'Filip', 'Lukić');
    const teodora = findDoctor(doctors, 'Teodora', 'Milić');
    const mina = findDoctor(doctors, 'Mina', 'Radosavljević');
    const allTimeId = vuk.id;
    const monthDoctor = (filip && filip.id !== allTimeId ? filip : teodora && teodora.id !== allTimeId ? teodora : doctors.find((doctor) => doctor.id !== allTimeId)) ?? vuk;
    const monthId = monthDoctor.id;
    const preferredAllTimeId = vuk.services.find((service) => service.name === 'Kardiološki pregled')?.id
        ?? vuk.services[0]?.id
        ?? null;
    const preferredMonthId = monthDoctor.services.find((service) => service.name === 'ORL pregled')?.id
        ?? monthDoctor.services[0]?.id
        ?? null;

    for (const date of dates) {
        const future = compareIsoDates(date, today) > 0;
        const past = compareIsoDates(date, today) < 0;
        for (const doctor of doctors) {
            const resolution = effectiveFor(doctor, date, absences, exceptions, locations);
            if (!resolution.effective) {
                continue;
            }
            const token = `${doctor.id}:${date}`;
            const volume = monthVolume(date) * doctorWeight(doctor.id, date, today, allTimeId, monthId);
            let percent = past ? Math.round(7 * volume) : future ? Math.round(4 * volume) : 18;
            if (date === today) {
                percent = 0;
            }
            if (past && monthKey(date) === monthKey(today) && doctor.id === allTimeId) {
                percent = Math.round(percent * 0.35);
            }
            if (!chance(11, token, percent)) {
                continue;
            }
            const extra = chance(12, `${token}:n`, past ? 28 : 12);
            tryPlace(list, doctor, date, today, nowMinutes, patients, absences, exceptions, locations, blocking, preferredAllTimeId, preferredMonthId, `${token}:a`);
            if (extra) {
                tryPlace(list, doctor, date, today, nowMinutes, patients, absences, exceptions, locations, blocking, preferredAllTimeId, preferredMonthId, `${token}:b`);
            }
        }
    }

    const todayDoctors = doctors.filter((doctor) => effectiveFor(doctor, today, absences, exceptions, locations).effective);
    for (let index = 0; index < Math.min(8, todayDoctors.length); index += 1) {
        const doctor = todayDoctors[pickInt(71, `today:${index}`, todayDoctors.length)];
        tryPlace(list, doctor, today, today, nowMinutes, patients, absences, exceptions, locations, blocking, preferredAllTimeId, preferredMonthId, `today-force:${index}:${doctor.id}`);
    }

    const monthStart = `${today.slice(0, 7)}-01`;
    for (const date of eachDateInclusive(monthStart, addCalendarDays(today, -1))) {
        if (!effectiveFor(monthDoctor, date, absences, exceptions, locations).effective) {
            continue;
        }
        if (!chance(85, `month-leader:${date}`, 100)) {
            continue;
        }
        tryPlace(list, monthDoctor, date, today, nowMinutes, patients, absences, exceptions, locations, blocking, preferredAllTimeId, preferredMonthId, `month-leader:${date}`, null, 'completed');
        if (chance(86, `month-leader-extra:${date}`, 40)) {
            tryPlace(list, monthDoctor, date, today, nowMinutes, patients, absences, exceptions, locations, blocking, preferredAllTimeId, preferredMonthId, `month-leader2:${date}`, null, 'completed');
        }
    }
    for (const date of eachDateInclusive(monthStart, addCalendarDays(today, -1))) {
        if (!chance(81, `month:${date}`, 42)) {
            continue;
        }
        const available = doctors.filter((doctor) => effectiveFor(doctor, date, absences, exceptions, locations).effective);
        if (!available.length) {
            continue;
        }
        const doctor = available[pickInt(82, `month-doc:${date}`, available.length)];
        tryPlace(list, doctor, date, today, nowMinutes, patients, absences, exceptions, locations, blocking, preferredAllTimeId, preferredMonthId, `month:${date}`, null, 'completed');
    }

    for (let offset = 1; offset <= 18; offset += 1) {
        const date = addCalendarDays(today, offset);
        if (!chance(91, `future:${date}`, 78)) {
            continue;
        }
        const available = doctors.filter((doctor) => effectiveFor(doctor, date, absences, exceptions, locations).effective);
        if (!available.length) {
            continue;
        }
        const doctor = available[pickInt(92, `future-doc:${date}`, available.length)];
        tryPlace(list, doctor, date, today, nowMinutes, patients, absences, exceptions, locations, blocking, preferredAllTimeId, preferredMonthId, `future:${date}`, null, 'confirmed');
    }

    const portalDoctors = [vuk, mina].filter((doctor): doctor is CatalogDoctor => Boolean(doctor));
    for (const doctor of portalDoctors) {
        for (let offset = -18; offset <= 16; offset += 1) {
            const date = addCalendarDays(today, offset);
            if (!effectiveFor(doctor, date, absences, exceptions, locations).effective) {
                continue;
            }
            if (!chance(101, `portal:${doctor.id}:${date}`, offset === 0 ? 80 : 28)) {
                continue;
            }
            const forceStatus = compareIsoDates(date, today) < 0
                ? 'completed'
                : compareIsoDates(date, today) > 0
                    ? 'confirmed'
                    : undefined;
            tryPlace(list, doctor, date, today, nowMinutes, patients, absences, exceptions, locations, blocking, preferredAllTimeId, preferredMonthId, `portal:${doctor.id}:${date}`, offset % 5 === 0 ? 0 : null, forceStatus);
        }
    }

    const demoPatientDates = [-40, -25, -12, -4, 3, 9];
    for (const offset of demoPatientDates) {
        const date = addCalendarDays(today, offset);
        const available = doctors.filter((doctor) => effectiveFor(doctor, date, absences, exceptions, locations).effective);
        if (!available.length) {
            continue;
        }
        const doctor = available[pickInt(111, `demo-p:${date}`, available.length)];
        const forceStatus = offset < 0 ? 'completed' : 'confirmed';
        tryPlace(list, doctor, date, today, nowMinutes, patients, absences, exceptions, locations, blocking, preferredAllTimeId, preferredMonthId, `demo-p:${date}`, 0, forceStatus);
    }

    for (let monthOffset = 11; monthOffset >= 0; monthOffset -= 1) {
        const [year, month] = today.split('-').map(Number);
        const point = new Date(Date.UTC(year, month - 1 - monthOffset, 8));
        const sample = `${point.getUTCFullYear()}-${String(point.getUTCMonth() + 1).padStart(2, '0')}-08`;
        const completedHere = list.some((item) => item.status === 'completed' && monthKey(item.date) === monthKey(sample) && compareIsoDates(item.date, today) <= 0);
        if (completedHere || compareIsoDates(sample, today) > 0) {
            continue;
        }
        const probeDates = eachDateInclusive(addCalendarDays(sample, -6), addCalendarDays(sample, 6))
            .filter((date) => compareIsoDates(date, today) < 0);
        for (const date of probeDates) {
            const available = doctors.filter((doctor) => effectiveFor(doctor, date, absences, exceptions, locations).effective);
            if (!available.length) {
                continue;
            }
            const doctor = available[pickInt(121, `fill:${date}`, available.length)];
            if (tryPlace(list, doctor, date, today, nowMinutes, patients, absences, exceptions, locations, blocking, preferredAllTimeId, preferredMonthId, `fill:${date}`, null, 'completed')) {
                break;
            }
        }
    }

    return list;
}

async function insertRows(
    connection: PoolConnection,
    sql: string,
    rows: unknown[][]
): Promise<number> {
    if (!rows.length) {
        return 0;
    }
    const [result] = await connection.query<ResultSetHeader>(sql, [rows]);
    return Number(result.insertId);
}

async function generate(): Promise<void> {
    const clock = clinicClock();
    const today = clock.date;
    console.log(`Clinic date: ${today} ${minutesToTimeLabel(clock.minutes)} (Europe/Belgrade)`);

    const catalog = await loadCatalog();
    await ensureLedgerTable();

    const connection = await pool.getConnection();
    let patientsInserted = 0;
    let appointmentsInserted = 0;
    let reviewsInserted = 0;
    let reportsInserted = 0;
    let absencesInserted = 0;
    let exceptionsInserted = 0;
    const patients = buildPatients();
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_ROUNDS);

    try {
        await connection.beginTransaction();
        await cleanupDemoData(connection);

        const operational = await loadOperationalState(connection);
        const plannedAbsences = planAbsences(catalog.doctors, today, operational.absences);
        const absences = [...operational.absences, ...plannedAbsences];
        const plannedExceptions = planExceptions(
            catalog.doctors,
            catalog.locations,
            today,
            absences,
            operational.exceptions,
            operational.blocking
        );
        const exceptions = [...operational.exceptions, ...plannedExceptions];
        const appointments = planAppointments({
            doctors: catalog.doctors,
            locations: catalog.locations,
            patients,
            absences,
            exceptions,
            blocking: operational.blocking,
            today,
            nowMinutes: clock.minutes
        });

        if (appointments.length < TARGET_MIN) {
            fail(`Generisano je premalo termina (${appointments.length}). Proverite rasporede lekara.`);
        }

        const firstPatientId = await insertRows(
            connection,
            `INSERT INTO patients (first_name, last_name, jmbg, email, phone, password_hash) VALUES ?`,
            patients.map((patient) => [
                patient.firstName,
                patient.lastName,
                patient.jmbg,
                patient.email,
                patient.phone,
                passwordHash
            ])
        );
        patientsInserted = patients.length;
        const patientIds = patients.map((_, index) => firstPatientId + index);

        const absenceIds: number[] = [];
        for (const absence of plannedAbsences) {
            const [result] = await connection.query<ResultSetHeader>(
                `INSERT INTO doctor_absences (doctor_id, start_date, end_date, reason) VALUES (?, ?, ?, ?)`,
                [absence.doctorId, absence.startDate, absence.endDate, absence.reason]
            );
            absenceIds.push(Number(result.insertId));
        }
        absencesInserted = absenceIds.length;

        const exceptionIds: number[] = [];
        for (const exception of plannedExceptions) {
            const [result] = await connection.query<ResultSetHeader>(
                `INSERT INTO doctor_schedule_exceptions (doctor_id, exception_date, start_time, end_time, location_id)
                 VALUES (?, ?, ?, ?, ?)`,
                [exception.doctorId, exception.date, exception.startTime, exception.endTime, exception.locationId]
            );
            exceptionIds.push(Number(result.insertId));
        }
        exceptionsInserted = exceptionIds.length;

        const appointmentRows = appointments.map((item) => [
            item.patientIndex === null ? null : patientIds[item.patientIndex],
            item.doctorId,
            item.serviceId,
            item.locationId,
            item.date,
            `${item.startTime}:00`,
            `${item.endTime}:00`,
            item.firstName,
            item.lastName,
            item.jmbg,
            item.email,
            item.phone,
            item.status,
            item.cancelledBy
        ]);
        const firstAppointmentId = await insertRows(
            connection,
            `INSERT INTO appointments (
                patient_id, doctor_id, service_id, location_id, appointment_date, start_time, end_time,
                patient_first_name, patient_last_name, patient_jmbg, patient_email, patient_phone, status, cancelled_by
             ) VALUES ?`,
            appointmentRows
        );
        appointmentsInserted = appointments.length;
        const appointmentIds = appointments.map((_, index) => firstAppointmentId + index);

        const reviewRows: unknown[][] = [];
        const reportRows: unknown[][] = [];
        appointments.forEach((item, index) => {
            const appointmentId = appointmentIds[index];
            if (item.status !== 'completed') {
                return;
            }
            const token = `rev:${appointmentId}`;
            if (item.patientIndex !== null && chance(201, token, 46)) {
                const ratingRoll = pickInt(202, token, 20);
                const rating = ratingRoll === 0 ? 2 : ratingRoll <= 2 ? 3 : ratingRoll <= 9 ? 4 : 5;
                const comment = chance(203, `${token}:c`, 70)
                    ? REVIEW_COMMENTS[pickInt(204, `${token}:t`, REVIEW_COMMENTS.length)]
                    : null;
                reviewRows.push([appointmentId, rating, comment]);
            }
            if (chance(211, `rep:${appointmentId}`, 78)) {
                const report = REPORTS[pickInt(212, `rep:${appointmentId}`, REPORTS.length)];
                reportRows.push([appointmentId, report.anamnesis, report.findings, report.diagnosis, report.therapy]);
            }
        });
        if (reviewRows.length) {
            await insertRows(
                connection,
                'INSERT INTO doctor_reviews (appointment_id, rating, comment) VALUES ?',
                reviewRows
            );
            reviewsInserted = reviewRows.length;
        }
        if (reportRows.length) {
            await insertRows(
                connection,
                `INSERT INTO appointment_reports
                    (appointment_id, anamnesis, findings, diagnosis, therapy_recommendations)
                 VALUES ?`,
                reportRows
            );
            reportsInserted = reportRows.length;
        }

        const ledgerRows = [
            ...absenceIds.map((id) => ['absence', id]),
            ...exceptionIds.map((id) => ['exception', id])
        ];
        if (ledgerRows.length) {
            await insertRows(connection, 'INSERT INTO demo_data_ledger (entity_type, entity_id) VALUES ?', ledgerRows);
        }

        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }

    await verifyAndPrint({
        today,
        patientsInserted,
        appointmentsInserted,
        reviewsInserted,
        reportsInserted,
        absencesInserted,
        exceptionsInserted
    });
}

async function verifyAndPrint(input: {
    today: string;
    patientsInserted: number;
    appointmentsInserted: number;
    reviewsInserted: number;
    reportsInserted: number;
    absencesInserted: number;
    exceptionsInserted: number;
}): Promise<void> {
    const emailLike = `%@${DEMO_EMAIL_DOMAIN}`;
    const [statusRows] = await pool.query<(RowDataPacket & { status: string; total: number })[]>(
        `SELECT status, COUNT(*) AS total FROM appointments WHERE patient_email LIKE ? GROUP BY status`,
        [emailLike]
    );
    const [todayRow] = await pool.query<(RowDataPacket & { total: number })[]>(
        `SELECT COUNT(*) AS total FROM appointments WHERE appointment_date = ?`,
        [input.today]
    );
    const [guestRow] = await pool.query<(RowDataPacket & { total: number })[]>(
        `SELECT COUNT(*) AS total FROM appointments WHERE patient_email LIKE ? AND patient_id IS NULL`,
        [emailLike]
    );
    const [rangeRow] = await pool.query<(RowDataPacket & { firstDate: string; lastDate: string })[]>(
        `SELECT DATE_FORMAT(MIN(appointment_date), '%Y-%m-%d') AS firstDate,
                DATE_FORMAT(MAX(appointment_date), '%Y-%m-%d') AS lastDate
         FROM appointments WHERE patient_email LIKE ?`,
        [emailLike]
    );
    const [overlapRows] = await pool.query<RowDataPacket[]>(
        `SELECT a.id AS aId, b.id AS bId
         FROM appointments a
         INNER JOIN appointments b
            ON a.doctor_id = b.doctor_id
           AND a.appointment_date = b.appointment_date
           AND a.id < b.id
           AND a.status IN ('confirmed', 'completed')
           AND b.status IN ('confirmed', 'completed')
           AND a.start_time < b.end_time
           AND a.end_time > b.start_time
         LIMIT 5`
    );
    const [futureCompleted] = await pool.query<(RowDataPacket & { total: number })[]>(
        `SELECT COUNT(*) AS total FROM appointments
         WHERE patient_email LIKE ? AND status = 'completed' AND appointment_date > ?`,
        [emailLike, input.today]
    );
    const [absentConflict] = await pool.query<RowDataPacket[]>(
        `SELECT a.id
         FROM appointments a
         INNER JOIN doctor_absences abs
            ON abs.doctor_id = a.doctor_id
           AND a.appointment_date BETWEEN abs.start_date AND abs.end_date
         WHERE a.patient_email LIKE ? AND a.status IN ('confirmed', 'completed')
         LIMIT 5`,
        [emailLike]
    );
    const [invalidPair] = await pool.query<RowDataPacket[]>(
        `SELECT a.id
         FROM appointments a
         LEFT JOIN doctor_services ds
            ON ds.doctor_id = a.doctor_id AND ds.service_id = a.service_id
         WHERE a.patient_email LIKE ? AND ds.doctor_id IS NULL
         LIMIT 5`,
        [emailLike]
    );
    const [openSlots] = await pool.query<(RowDataPacket & { doctorId: number; workDays: number })[]>(
        `SELECT sc.doctor_id AS doctorId, COUNT(*) AS workDays
         FROM doctor_schedules sc
         GROUP BY sc.doctor_id
         LIMIT 3`
    );

    if (overlapRows.length) {
        fail('Pronađeni su preklapajući potvrđeni/završeni termini.');
    }
    if (Number(futureCompleted[0]?.total ?? 0) > 0) {
        fail('Pronađeni su završeni termini u budućnosti.');
    }
    if (absentConflict.length) {
        fail('Pronađen je termin tokom odsustva lekara.');
    }
    if (invalidPair.length) {
        fail('Pronađena je nemoguća kombinacija lekar/usluga.');
    }

    const counts = Object.fromEntries(statusRows.map((row) => [row.status, Number(row.total)]));
    const completed = counts.completed ?? 0;
    const confirmed = counts.confirmed ?? 0;
    const cancelled = counts.cancelled ?? 0;
    const total = completed + confirmed + cancelled + (counts.no_show ?? 0);
    const cancelRate = total === 0 ? 0 : (cancelled / (confirmed + completed + cancelled)) * 100;

    const popular = async (from: string | null, to: string | null, kind: 'doctor' | 'service') => {
        if (kind === 'doctor') {
            const [rows] = await pool.query<(RowDataPacket & {
                firstName: string;
                lastName: string;
                total: number;
            })[]>(
                `SELECT d.first_name AS firstName, d.last_name AS lastName, COUNT(*) AS total
                 FROM appointments a
                 INNER JOIN doctors d ON d.id = a.doctor_id
                 WHERE a.status IN ('confirmed', 'completed')
                   ${from && to ? 'AND a.appointment_date BETWEEN ? AND ?' : ''}
                 GROUP BY d.id, d.first_name, d.last_name
                 ORDER BY total DESC, d.last_name ASC
                 LIMIT 1`,
                from && to ? [from, to] : []
            );
            const row = rows[0];
            return row ? `dr ${row.firstName} ${row.lastName} (${row.total})` : 'n/a';
        }
        const [rows] = await pool.query<(RowDataPacket & { name: string; total: number })[]>(
            `SELECT sv.name, COUNT(*) AS total
             FROM appointments a
             INNER JOIN services sv ON sv.id = a.service_id
             WHERE a.status IN ('confirmed', 'completed')
               ${from && to ? 'AND a.appointment_date BETWEEN ? AND ?' : ''}
             GROUP BY sv.id, sv.name
             ORDER BY total DESC, sv.name ASC
             LIMIT 1`,
            from && to ? [from, to] : []
        );
        const row = rows[0];
        return row ? `${row.name} (${row.total})` : 'n/a';
    };

    const monthEnd = formatUtcDate(new Date(Date.UTC(
        Number(input.today.slice(0, 4)),
        Number(input.today.slice(5, 7)),
        0
    )));
    const monthRange = {
        from: `${input.today.slice(0, 7)}-01`,
        to: monthEnd
    };
    const [specialtyRows] = await pool.query<(RowDataPacket & { name: string; total: number })[]>(
        `SELECT sp.name, COUNT(a.id) AS total
         FROM specialties sp
         LEFT JOIN services sv ON sv.specialty_id = sp.id
         LEFT JOIN appointments a ON a.service_id = sv.id AND a.status IN ('confirmed', 'completed')
         GROUP BY sp.id, sp.name
         ORDER BY total DESC, sp.name ASC`
    );
    const [locationRows] = await pool.query<(RowDataPacket & { name: string; total: number })[]>(
        `SELECT l.name, COUNT(a.id) AS total
         FROM locations l
         LEFT JOIN appointments a ON a.location_id = l.id AND a.status IN ('confirmed', 'completed')
         GROUP BY l.id, l.name
         ORDER BY total DESC, l.name ASC`
    );

    console.log('\nDEMO DATA GENERATED\n');
    console.log(`Patients: ${input.patientsInserted}`);
    console.log(`Appointments: ${input.appointmentsInserted}`);
    console.log(`Today: ${Number(todayRow[0]?.total ?? 0)}`);
    console.log(`Completed: ${completed}`);
    console.log(`Confirmed: ${confirmed}`);
    console.log(`Cancelled: ${cancelled}`);
    console.log(`Guest appointments: ${Number(guestRow[0]?.total ?? 0)}`);
    console.log(`Reviews: ${input.reviewsInserted}`);
    console.log(`Reports: ${input.reportsInserted}`);
    console.log(`Schedule exceptions: ${input.exceptionsInserted}`);
    console.log(`Absences: ${input.absencesInserted}`);
    console.log(`Date range: ${rangeRow[0]?.firstDate ?? 'n/a'} → ${rangeRow[0]?.lastDate ?? 'n/a'}`);
    console.log(`Current month most requested doctor: ${await popular(monthRange.from, monthRange.to, 'doctor')}`);
    console.log(`Current month most requested service: ${await popular(monthRange.from, monthRange.to, 'service')}`);
    console.log(`All-time most requested doctor: ${await popular(null, null, 'doctor')}`);
    console.log(`All-time most requested service: ${await popular(null, null, 'service')}`);
    console.log('Demand by specialty:');
    for (const row of specialtyRows) {
        console.log(`  - ${row.name}: ${row.total}`);
    }
    console.log('Demand by location:');
    for (const row of locationRows) {
        console.log(`  - ${row.name}: ${row.total}`);
    }
    console.log(`Overall cancellation rate: ${cancelRate.toFixed(1)}%`);
    console.log('\nDemo patient login');
    console.log(`  Email: ${DEMO_PATIENT_EMAIL}`);
    console.log(`  Password: ${DEMO_PASSWORD}`);
    console.log('\nDoctor portal accounts were not created or reset.');
    console.log('Existing doctor accounts remain unchanged so admin provisioning can still be demonstrated.');
    console.log('\nRegenerate with: npm run demo:data');
    console.log('Re-run deletes only previous @demo.vitamed.rs patients/appointments/reviews/reports');
    console.log('and absences/exceptions recorded in demo_data_ledger. Seed catalog data is never deleted.');
    void openSlots;
}

async function main(): Promise<void> {
    await generate();
}

void main()
    .catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
        process.exit(process.exitCode ?? 0);
    });
