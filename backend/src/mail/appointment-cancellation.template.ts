export interface ClinicCancellationContent {
    patientFirstName: string;
    serviceName: string;
    doctorName: string;
    locationName: string;
    locationAddress: string;
    appointmentDateLabel: string;
    startTime: string;
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export function buildClinicCancellationEmail(data: ClinicCancellationContent): {
    subject: string;
    html: string;
    text: string;
} {
    const notice = `Vaš pregled "${data.serviceName}", zakazan za ${data.appointmentDateLabel} u ${data.startTime}, otkazan je od strane klinike.`;

    const text = [
        `Poštovana/Poštovani ${data.patientFirstName},`,
        '',
        notice,
        '',
        `Usluga: ${data.serviceName}`,
        `Lekar: ${data.doctorName}`,
        `Lokacija: ${data.locationName}`,
        data.locationAddress,
        `Datum: ${data.appointmentDateLabel}`,
        `Vreme: ${data.startTime}`,
        '',
        'Ukoliko želite da zakažete novi termin, posetite VitaMed ili nas kontaktirajte.',
        '',
        'VitaMed',
        'Privatna klinika'
    ].join('\n');

    const html = `<!DOCTYPE html>
<html lang="sr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Otkazivanje pregleda</title>
</head>
<body style="margin:0;padding:0;background:#f5f3ee;color:#17343a;font-family:'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f3ee;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #d9d6cf;">
          <tr>
            <td style="background:#17343a;padding:22px 28px;color:#f5f3ee;">
              <div style="font-size:26px;letter-spacing:0.02em;">Vita<span style="font-style:italic;">Med</span></div>
              <div style="margin-top:6px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#c9b4b6;">Privatna klinika</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 28px 8px;">
              <p style="margin:0 0 14px;font-size:16px;">Poštovana/Poštovani ${escapeHtml(data.patientFirstName)},</p>
              <p style="margin:0 0 22px;font-size:15px;line-height:1.6;">${escapeHtml(notice)}</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f3ee;border:1px solid #e7e2d8;">
                <tr>
                  <td style="padding:18px 20px;">
                    <p style="margin:0 0 14px;font-size:18px;font-weight:600;">${escapeHtml(data.serviceName)}</p>
                    <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#7a3f46;">Lekar</p>
                    <p style="margin:0 0 12px;font-size:15px;">${escapeHtml(data.doctorName)}</p>
                    <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#7a3f46;">Lokacija</p>
                    <p style="margin:0 0 12px;font-size:15px;line-height:1.5;">${escapeHtml(data.locationName)}<br>${escapeHtml(data.locationAddress)}</p>
                    <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#7a3f46;">Datum</p>
                    <p style="margin:0 0 12px;font-size:15px;">${escapeHtml(data.appointmentDateLabel)}</p>
                    <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#7a3f46;">Vreme</p>
                    <p style="margin:0;font-size:15px;">${escapeHtml(data.startTime)}</p>
                  </td>
                </tr>
              </table>
              <p style="margin:22px 0 0;font-size:15px;line-height:1.6;">Ukoliko želite da zakažete novi termin, posetite VitaMed ili nas kontaktirajte.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 26px;color:#5c6564;font-size:13px;">
              VitaMed<br>Privatna klinika
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    return {
        subject: 'Otkazivanje pregleda | VitaMed',
        html,
        text
    };
}
