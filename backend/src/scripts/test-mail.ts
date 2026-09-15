import { MailService } from '../mail/mail.service';

async function main(): Promise<void> {
    const to = process.env.TEST_MAIL_TO?.trim() || process.env.SMTP_USER?.trim();

    if (!to) {
        console.error('[MAIL] Set TEST_MAIL_TO or SMTP_USER in .env to run the mail test.');
        process.exitCode = 1;
        return;
    }

    console.log('[MAIL] Running standalone SMTP test (no appointment is created).');
    const sent = await new MailService().sendTestEmail(to);
    process.exitCode = sent ? 0 : 1;
}

void main();
