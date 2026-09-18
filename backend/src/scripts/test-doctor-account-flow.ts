import { RowDataPacket } from 'mysql2/promise';
import pool from '../db/connection';

const BASE = 'http://localhost:3000';
const ADMIN_EMAIL = 'admin@vitamed.rs';
const ADMIN_PASSWORD = 'Admin1234!';
const EXISTING_DOCTOR_EMAIL = 'mina.radosavljevic@vitamed.rs';
const EXISTING_DOCTOR_PASSWORD = 'Test1234!';

interface JsonResponse {
    status: number;
    body: Record<string, unknown>;
}

function assert(name: string, condition: boolean): void {
    if (!condition) {
        throw new Error(`FAIL ${name}`);
    }
    console.log(`PASS ${name}`);
}

async function request(
    method: string,
    path: string,
    options: { token?: string; body?: unknown } = {}
): Promise<JsonResponse> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (options.token) {
        headers.Authorization = `Bearer ${options.token}`;
    }
    const response = await fetch(`${BASE}${path}`, {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
    const body = await response.json().catch(() => ({}));
    return { status: response.status, body: body as Record<string, unknown> };
}

async function main(): Promise<void> {
    const adminLogin = await request('POST', '/api/admin-auth/login', {
        body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
    });
    assert('admin login', adminLogin.status === 200 && typeof adminLogin.body.token === 'string');
    const adminToken = String(adminLogin.body.token);

    const minaLogin = await request('POST', '/api/doctor-auth/login', {
        body: { email: EXISTING_DOCTOR_EMAIL, password: EXISTING_DOCTOR_PASSWORD }
    });
    const minaDoctor = minaLogin.body.doctor as { mustChangePassword?: boolean } | undefined;
    assert('existing doctor login', minaLogin.status === 200 && minaDoctor?.mustChangePassword === false);
    const minaDashboard = await request('GET', '/api/doctor-portal/dashboard', {
        token: String(minaLogin.body.token)
    });
    assert('existing doctor portal', minaDashboard.status === 200);

    const [doctors] = await pool.query<(RowDataPacket & { id: number; firstName: string; lastName: string })[]>(
        `SELECT d.id, d.first_name AS firstName, d.last_name AS lastName
         FROM doctors d
         LEFT JOIN doctor_accounts a ON a.doctor_id = d.id
         WHERE a.id IS NULL
         ORDER BY d.id
         LIMIT 1`
    );
    const doctor = doctors[0];
    assert('doctor without account exists', Boolean(doctor));

    const unauthStatus = await request('GET', `/api/admin-portal/doctors/${doctor.id}/account`);
    assert('account status requires admin', unauthStatus.status === 401);

    const status = await request('GET', `/api/admin-portal/doctors/${doctor.id}/account`, {
        token: adminToken
    });
    assert('missing account status', status.status === 200 && status.body.status === 'missing');
    assert('status has no hash', !('password_hash' in status.body) && !('temporaryPassword' in status.body));

    const suggestion = await request(
        'GET',
        `/api/admin-portal/doctors/${doctor.id}/account/email-suggestion`,
        { token: adminToken }
    );
    const suggestedEmail = String(suggestion.body.email);
    assert('email suggestion', suggestion.status === 200 && suggestedEmail.endsWith('@vitamed.rs'));

    const generated = await request(
        'POST',
        `/api/admin-portal/doctors/${doctor.id}/account/temporary-password`,
        { token: adminToken }
    );
    const generatedAgain = await request(
        'POST',
        `/api/admin-portal/doctors/${doctor.id}/account/temporary-password`,
        { token: adminToken }
    );
    assert('temp password generated', generated.status === 200 && typeof generated.body.password === 'string');
    assert(
        'temp passwords independent',
        generated.body.password !== generatedAgain.body.password
    );

    const [beforeCreate] = await pool.query<(RowDataPacket & { total: number })[]>(
        'SELECT COUNT(*) AS total FROM doctor_accounts WHERE doctor_id = ?',
        [doctor.id]
    );
    assert('generate does not persist', Number(beforeCreate[0].total) === 0);

    const created = await request('POST', `/api/admin-portal/doctors/${doctor.id}/account`, {
        token: adminToken,
        body: { email: suggestedEmail, password: generated.body.password }
    });
    assert('account created', created.status === 201);
    const createdAccount = created.body.account as { status?: string; mustChangePassword?: boolean };
    assert('created pending', createdAccount.status === 'pending' && createdAccount.mustChangePassword === true);
    const temporaryPassword = String(created.body.temporaryPassword);
    assert('temp returned once', Boolean(temporaryPassword) && !('password_hash' in created.body));

    const [stored] = await pool.query<(RowDataPacket & {
        passwordHash: string;
        mustChange: number | boolean;
        email: string;
    })[]>(
        `SELECT password_hash AS passwordHash, must_change_password AS mustChange, email
         FROM doctor_accounts WHERE doctor_id = ? LIMIT 1`,
        [doctor.id]
    );
    assert('hash stored not plaintext', stored[0].passwordHash !== temporaryPassword);
    assert('hash looks bcrypt', stored[0].passwordHash.startsWith('$2'));
    assert('must_change true', stored[0].mustChange === 1 || stored[0].mustChange === true);
    assert('email stored', stored[0].email === suggestedEmail);

    const duplicateAccount = await request('POST', `/api/admin-portal/doctors/${doctor.id}/account`, {
        token: adminToken,
        body: { email: `other.${suggestedEmail}`, password: temporaryPassword }
    });
    assert('duplicate account rejected', duplicateAccount.status === 409);
    assert(
        'duplicate account message',
        String(duplicateAccount.body.message) === 'Nalog za ovog lekara je već kreiran.'
    );

    const [otherDoctors] = await pool.query<(RowDataPacket & { id: number })[]>(
        `SELECT d.id
         FROM doctors d
         LEFT JOIN doctor_accounts a ON a.doctor_id = d.id
         WHERE a.id IS NULL AND d.id <> ?
         ORDER BY d.id
         LIMIT 1`,
        [doctor.id]
    );
    if (otherDoctors[0]) {
        const emailClash = await request('POST', `/api/admin-portal/doctors/${otherDoctors[0].id}/account`, {
            token: adminToken,
            body: { email: suggestedEmail, password: temporaryPassword }
        });
        assert('duplicate email rejected', emailClash.status === 409);
        assert(
            'duplicate email message',
            String(emailClash.body.message) === 'Navedena email adresa je već u upotrebi.'
        );
    }

    const wrongLogin = await request('POST', '/api/doctor-auth/login', {
        body: { email: suggestedEmail, password: 'WrongPass1' }
    });
    assert('wrong temp rejected', wrongLogin.status === 401);

    const firstLogin = await request('POST', '/api/doctor-auth/login', {
        body: { email: suggestedEmail, password: temporaryPassword }
    });
    const firstDoctor = firstLogin.body.doctor as { mustChangePassword?: boolean } | undefined;
    assert('temp login accepted', firstLogin.status === 200 && firstDoctor?.mustChangePassword === true);
    const firstToken = String(firstLogin.body.token);

    const blockedDashboard = await request('GET', '/api/doctor-portal/dashboard', { token: firstToken });
    assert('portal blocked while pending', blockedDashboard.status === 403);
    assert(
        'portal block code',
        blockedDashboard.body.code === 'PASSWORD_CHANGE_REQUIRED'
    );

    const blockedPatients = await request('GET', '/api/doctor-portal/patients', { token: firstToken });
    assert('patients blocked while pending', blockedPatients.status === 403);

    const me = await request('GET', '/api/doctor-auth/me', { token: firstToken });
    assert('me allowed while pending', me.status === 200 && me.body.mustChangePassword === true);

    const reuse = await request('POST', '/api/doctor-auth/change-password', {
        token: firstToken,
        body: { password: temporaryPassword, confirmPassword: temporaryPassword }
    });
    assert('reuse rejected', reuse.status === 400);
    assert(
        'reuse message',
        String(reuse.body.message) === 'Nova lozinka mora da se razlikuje od privremene lozinke.'
    );

    const mismatch = await request('POST', '/api/doctor-auth/change-password', {
        token: firstToken,
        body: { password: 'Clinic91', confirmPassword: 'Clinic92' }
    });
    assert('mismatch rejected', mismatch.status === 400);

    const weak = await request('POST', '/api/doctor-auth/change-password', {
        token: firstToken,
        body: { password: 'short1', confirmPassword: 'short1' }
    });
    assert('weak password rejected', weak.status === 400);

    const personalPassword = 'Clinic91x';
    const changed = await request('POST', '/api/doctor-auth/change-password', {
        token: firstToken,
        body: { password: personalPassword, confirmPassword: personalPassword }
    });
    const changedDoctor = changed.body.doctor as { mustChangePassword?: boolean } | undefined;
    assert('password changed', changed.status === 200 && changedDoctor?.mustChangePassword === false);
    const changedToken = String(changed.body.token);

    const [afterChange] = await pool.query<(RowDataPacket & {
        passwordHash: string;
        mustChange: number | boolean;
    })[]>(
        `SELECT password_hash AS passwordHash, must_change_password AS mustChange
         FROM doctor_accounts WHERE doctor_id = ? LIMIT 1`,
        [doctor.id]
    );
    assert('hash replaced', afterChange[0].passwordHash !== stored[0].passwordHash);
    assert('must_change false', afterChange[0].mustChange === 0 || afterChange[0].mustChange === false);

    const oldTempLogin = await request('POST', '/api/doctor-auth/login', {
        body: { email: suggestedEmail, password: temporaryPassword }
    });
    assert('old temp no longer works', oldTempLogin.status === 401);

    const dashboard = await request('GET', '/api/doctor-portal/dashboard', { token: changedToken });
    assert('portal allowed after change', dashboard.status === 200);

    const oldTokenDashboard = await request('GET', '/api/doctor-portal/dashboard', { token: firstToken });
    assert('pre-change token allowed after personal password set', oldTokenDashboard.status === 200);

    const adminStatusActive = await request('GET', `/api/admin-portal/doctors/${doctor.id}/account`, {
        token: adminToken
    });
    assert('admin sees active', adminStatusActive.status === 200 && adminStatusActive.body.status === 'active');

    const reset = await request('POST', `/api/admin-portal/doctors/${doctor.id}/account/reset-password`, {
        token: adminToken
    });
    assert('password reset', reset.status === 200);
    const resetAccount = reset.body.account as { status?: string };
    assert('reset pending', resetAccount.status === 'pending');
    const resetPassword = String(reset.body.temporaryPassword);
    assert('new temp returned', Boolean(resetPassword) && resetPassword !== temporaryPassword);

    const oldPersonalLogin = await request('POST', '/api/doctor-auth/login', {
        body: { email: suggestedEmail, password: personalPassword }
    });
    assert('old personal password rejected', oldPersonalLogin.status === 401);

    const resetBlocked = await request('GET', '/api/doctor-portal/dashboard', { token: changedToken });
    assert('old token blocked after reset', resetBlocked.status === 403);

    const adminStatusPending = await request('GET', `/api/admin-portal/doctors/${doctor.id}/account`, {
        token: adminToken
    });
    assert('admin sees pending after reset', adminStatusPending.body.status === 'pending');

    const resetLogin = await request('POST', '/api/doctor-auth/login', {
        body: { email: suggestedEmail, password: resetPassword }
    });
    assert('reset temp login', resetLogin.status === 200);

    await pool.query('DELETE FROM doctor_accounts WHERE doctor_id = ?', [doctor.id]);
    console.log(`Cleaned test account for doctor ${doctor.id} (${suggestedEmail}).`);
    console.log('Doctor account flow checks passed.');
}

void main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
        process.exit(process.exitCode ?? 0);
    });
