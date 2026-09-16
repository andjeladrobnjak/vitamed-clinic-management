export function dateOfBirthFromJmbg(jmbg: unknown): string | null {
    const value = String(jmbg ?? '').trim();
    if (!/^\d{13}$/.test(value)) {
        return null;
    }

    const day = Number(value.slice(0, 2));
    const month = Number(value.slice(2, 4));
    const yearDigits = Number(value.slice(4, 7));
    if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(yearDigits)) {
        return null;
    }

    const year = yearDigits >= 800 ? 1000 + yearDigits : 2000 + yearDigits;
    const utc = Date.UTC(year, month - 1, day);
    const check = new Date(utc);
    if (
        check.getUTCFullYear() !== year ||
        check.getUTCMonth() !== month - 1 ||
        check.getUTCDate() !== day
    ) {
        return null;
    }

    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
