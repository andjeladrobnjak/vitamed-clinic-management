import { randomBytes } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { AdminPortalError } from './admin-portal.service';

const MAX_BYTES = 5 * 1024 * 1024;
const PUBLIC_PREFIX = '/uploads/doctors/';
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function doctorUploadsDir(): string {
    return path.resolve(__dirname, '..', '..', 'uploads', 'doctors');
}

export function isManagedDoctorUpload(imageUrl: string | null | undefined): boolean {
    if (!imageUrl || !imageUrl.startsWith(PUBLIC_PREFIX)) {
        return false;
    }

    const fileName = imageUrl.slice(PUBLIC_PREFIX.length);
    return !!fileName && !fileName.includes('/') && !fileName.includes('\\') && !fileName.includes('..');
}

export function sniffImageType(buffer: Buffer): 'jpg' | 'png' | 'webp' | null {
    if (buffer.length < 12) {
        return null;
    }

    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return 'jpg';
    }

    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
        return 'png';
    }

    if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
        return 'webp';
    }

    return null;
}

export async function storeDoctorImage(doctorId: number, mimeType: string, buffer: Buffer): Promise<string> {
    if (!ALLOWED_TYPES.has(mimeType)) {
        throw new AdminPortalError(400, 'Fotografija mora biti JPG, PNG ili WebP.');
    }

    if (buffer.length > MAX_BYTES) {
        throw new AdminPortalError(400, 'Fotografija ne može biti veća od 5 MB.');
    }

    const sniffed = sniffImageType(buffer);
    if (!sniffed) {
        throw new AdminPortalError(400, 'Fotografija mora biti JPG, PNG ili WebP.');
    }

    if (
        (mimeType === 'image/jpeg' && sniffed !== 'jpg') ||
        (mimeType === 'image/png' && sniffed !== 'png') ||
        (mimeType === 'image/webp' && sniffed !== 'webp')
    ) {
        throw new AdminPortalError(400, 'Fotografija mora biti JPG, PNG ili WebP.');
    }

    const fileName = `doctor-${doctorId}-${Date.now()}-${randomBytes(6).toString('hex')}.${sniffed}`;
    const directory = doctorUploadsDir();
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, fileName), buffer);
    return `${PUBLIC_PREFIX}${fileName}`;
}

export async function deleteManagedDoctorUpload(imageUrl: string | null | undefined): Promise<void> {
    if (!isManagedDoctorUpload(imageUrl) || !imageUrl) {
        return;
    }

    const fileName = path.basename(imageUrl);
    try {
        await unlink(path.join(doctorUploadsDir(), fileName));
    } catch {
        // Missing files are ignored so a failed cleanup cannot block saving.
    }
}
