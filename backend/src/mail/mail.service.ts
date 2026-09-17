import path from 'path';
import nodemailer, { Transporter } from 'nodemailer';
import dotenv from 'dotenv';
import {
    AppointmentConfirmationContent,
    buildAppointmentConfirmationEmail
} from './appointment-confirmation.template';
import {
    ClinicCancellationContent,
    buildClinicCancellationEmail
} from './appointment-cancellation.template';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface SmtpConfig {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    from: string;
}

function envFlag(value: string | undefined): boolean | undefined {
    if (value === undefined || value.trim() === '') {
        return undefined;
    }
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') {
        return true;
    }
    if (normalized === 'false' || normalized === '0') {
        return false;
    }
    return undefined;
}

function stripWrappingQuotes(value: string): string {
    const trimmed = value.trim();
    if (
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
}

function readSmtpConfig(): SmtpConfig | null {
    const host = process.env.SMTP_HOST?.trim();
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS;
    const fromRaw = process.env.MAIL_FROM?.trim() || user;
    const from = fromRaw ? stripWrappingQuotes(fromRaw) : '';
    const port = Number(process.env.SMTP_PORT || 587);
    const resolvedPort = Number.isFinite(port) ? port : 587;
    const secureFlag = envFlag(process.env.SMTP_SECURE);
    const secure = secureFlag ?? resolvedPort === 465;

    if (!host || !user || !pass || !from) {
        return null;
    }

    return { host, port: resolvedPort, secure, user, pass, from };
}

function logConfigPresence(config: SmtpConfig | null): void {
    console.log(`[MAIL] SMTP host configured: ${config ? 'yes' : 'no'}`);
    console.log(`[MAIL] SMTP user configured: ${process.env.SMTP_USER ? 'yes' : 'no'}`);
    console.log(`[MAIL] SMTP password configured: ${process.env.SMTP_PASS ? 'yes' : 'no'}`);
    console.log(`[MAIL] MAIL_FROM configured: ${process.env.MAIL_FROM || process.env.SMTP_USER ? 'yes' : 'no'}`);
    if (config) {
        console.log(`[MAIL] SMTP host: ${config.host}`);
        console.log(`[MAIL] SMTP port: ${config.port}`);
        console.log(`[MAIL] SMTP secure: ${config.secure}`);
    }
}

function logMailError(error: unknown): void {
    const err = error as {
        code?: string;
        command?: string;
        response?: string;
        responseCode?: number;
        message?: string;
    };
    console.error('[MAIL] Failed to send confirmation email');
    if (err.code) {
        console.error(`[MAIL] code: ${err.code}`);
    }
    if (err.command) {
        console.error(`[MAIL] command: ${err.command}`);
    }
    if (err.responseCode) {
        console.error(`[MAIL] responseCode: ${err.responseCode}`);
    }
    if (err.response) {
        console.error(`[MAIL] response: ${err.response}`);
    } else if (err.message) {
        console.error(`[MAIL] message: ${err.message}`);
    }
}

export class MailService {
    private createTransporter(config: SmtpConfig): Transporter {
        return nodemailer.createTransport({
            host: config.host,
            port: config.port,
            secure: config.secure,
            auth: {
                user: config.user,
                pass: config.pass
            }
        });
    }

    async verifyAtStartup(): Promise<void> {
        const config = readSmtpConfig();
        console.log('[MAIL] Checking SMTP configuration at startup');
        logConfigPresence(config);

        if (!config) {
            console.warn('[MAIL] Confirmation emails will be skipped until SMTP is configured.');
            return;
        }

        try {
            await this.createTransporter(config).verify();
            console.log('[MAIL] SMTP connection verified');
        } catch (error) {
            console.error('[MAIL] SMTP connection verification failed');
            logMailError(error);
        }
    }

    async sendAppointmentConfirmation(to: string, content: AppointmentConfirmationContent): Promise<boolean> {
        const recipient = String(to ?? '').trim();
        console.log(`[MAIL] Sending appointment confirmation to: ${recipient || '(missing recipient)'}`);

        const config = readSmtpConfig();
        logConfigPresence(config);

        if (!recipient) {
            console.error('[MAIL] Confirmation email not sent: recipient is missing.');
            return false;
        }

        if (!config) {
            console.error('[MAIL] Confirmation email not sent: SMTP is not configured.');
            return false;
        }

        const message = buildAppointmentConfirmationEmail(content);

        try {
            const transporter = this.createTransporter(config);
            const info = await transporter.sendMail({
                from: config.from,
                to: recipient,
                subject: message.subject,
                text: message.text,
                html: message.html
            });

            console.log('[MAIL] Confirmation email sent successfully');
            if (info.messageId) {
                console.log(`[MAIL] messageId: ${info.messageId}`);
            }
            return true;
        } catch (error) {
            logMailError(error);
            return false;
        }
    }

    async sendClinicCancellation(to: string, content: ClinicCancellationContent): Promise<boolean> {
        const recipient = String(to ?? '').trim();
        console.log(`[MAIL] Sending clinic cancellation notice to: ${recipient || '(missing recipient)'}`);

        const config = readSmtpConfig();
        logConfigPresence(config);

        if (!recipient) {
            console.error('[MAIL] Cancellation email not sent: recipient is missing.');
            return false;
        }

        if (!config) {
            console.error('[MAIL] Cancellation email not sent: SMTP is not configured.');
            return false;
        }

        const message = buildClinicCancellationEmail(content);

        try {
            const transporter = this.createTransporter(config);
            const info = await transporter.sendMail({
                from: config.from,
                to: recipient,
                subject: message.subject,
                text: message.text,
                html: message.html
            });

            console.log('[MAIL] Cancellation email sent successfully');
            if (info.messageId) {
                console.log(`[MAIL] messageId: ${info.messageId}`);
            }
            return true;
        } catch (error) {
            console.error('[MAIL] Failed to send cancellation email');
            logMailError(error);
            return false;
        }
    }

    async sendTestEmail(to: string): Promise<boolean> {
        const recipient = String(to ?? '').trim();
        console.log(`[MAIL] Sending standalone test email to: ${recipient || '(missing recipient)'}`);

        const config = readSmtpConfig();
        logConfigPresence(config);

        if (!recipient) {
            console.error('[MAIL] Test email not sent: recipient is missing.');
            return false;
        }

        if (!config) {
            console.error('[MAIL] Test email not sent: SMTP is not configured.');
            return false;
        }

        try {
            const transporter = this.createTransporter(config);
            const info = await transporter.sendMail({
                from: config.from,
                to: recipient,
                subject: 'VitaMed SMTP test',
                text: 'Ovo je test poruka. SMTP za VitaMed radi.',
                html: '<p>Ovo je test poruka. SMTP za VitaMed radi.</p>'
            });

            console.log('[MAIL] Test email sent successfully');
            if (info.messageId) {
                console.log(`[MAIL] messageId: ${info.messageId}`);
            }
            return true;
        } catch (error) {
            logMailError(error);
            return false;
        }
    }
}
