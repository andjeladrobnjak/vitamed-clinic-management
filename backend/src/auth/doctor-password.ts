import { randomInt } from 'crypto';

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';
const SPECIAL = '#@$%&*!?';
const ALL = `${UPPER}${LOWER}${DIGITS}${SPECIAL}`;
const PASSWORD_LENGTH = 12;

export const BCRYPT_ROUNDS = 10;

export function validateDoctorPassword(password: string): string | null {
    if (password.length < 8) {
        return 'Nova lozinka ne ispunjava bezbednosne zahteve.';
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
        return 'Nova lozinka ne ispunjava bezbednosne zahteve.';
    }
    return null;
}

export function generateTemporaryPassword(): string {
    const required = [
        pick(UPPER),
        pick(LOWER),
        pick(DIGITS),
        pick(SPECIAL)
    ];

    const chars = [...required];
    while (chars.length < PASSWORD_LENGTH) {
        chars.push(pick(ALL));
    }

    for (let index = chars.length - 1; index > 0; index -= 1) {
        const swap = randomInt(0, index + 1);
        const current = chars[index];
        chars[index] = chars[swap];
        chars[swap] = current;
    }

    return chars.join('');
}

export function suggestVitamedEmail(firstName: string, lastName: string): string {
    const first = slugPart(firstName);
    const last = slugPart(lastName);
    const local = [first, last].filter(Boolean).join('.') || 'lekar';
    return `${local}@vitamed.rs`;
}

export function nextVitamedEmail(baseEmail: string, taken: Set<string>): string {
    const normalized = baseEmail.trim().toLowerCase();
    if (!taken.has(normalized)) {
        return normalized;
    }

    const at = normalized.lastIndexOf('@');
    const local = at >= 0 ? normalized.slice(0, at) : normalized;
    const domain = at >= 0 ? normalized.slice(at) : '@vitamed.rs';
    const stem = local.replace(/\d+$/, '');
    let suffix = 2;
    let candidate = `${stem}${suffix}${domain}`;
    while (taken.has(candidate)) {
        suffix += 1;
        candidate = `${stem}${suffix}${domain}`;
    }
    return candidate;
}

function slugPart(value: string): string {
    const mapped = value
        .trim()
        .toLowerCase()
        .replace(/đ/g, 'dj')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/č|ć/g, 'c')
        .replace(/š/g, 's')
        .replace(/ž/g, 'z')
        .replace(/[^a-z]/g, '');
    return mapped;
}

function pick(source: string): string {
    return source[randomInt(0, source.length)];
}
