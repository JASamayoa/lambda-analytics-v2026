/**
 * Helper de envío de correos para lambda Learn vía Resend.
 *
 * Resend usa una API key (no SMTP user/pass). Las plantillas son las mismas
 * que diseñamos para Nodemailer — el switch fue de transporte, no de contenido.
 *
 * Dos funciones públicas:
 *   - sendAdminNotification(lead)   → notificación interna a learn@scilambda.net
 *   - sendLeadConfirmation(lead)    → confirmación al lead
 *
 * Paleta brand:
 *   --navy:#163b59  --navy-deep:#0d2640  --gold:#ffb530  --gold-deep:#e09a14
 *   --paper:#fafaf7 --paper-warm:#f4f1ea
 */
import { Resend } from 'resend';

let resend;
function getResend() {
  if (!resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY no está configurada. Ver DEPLOY-API.md.');
    }
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

const FROM = process.env.RESEND_FROM || 'lambda Learn <learn@scilambda.net>';
const ADMIN = process.env.ADMIN_EMAIL || 'learn@scilambda.net';

function escapeHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* =========================================================================
 * 1) Notificación interna al equipo
 * ========================================================================= */
export async function sendAdminNotification(lead) {
  const fullName = `${lead.nombre} ${lead.apellido}`.trim();
  const subject = `Nueva inscripción · ${lead.course_name} · ${fullName}`;
  const phoneDigits = (lead.telefono || '').replace(/[^0-9]/g, '');
  const waLink = phoneDigits ? `https://wa.me/${phoneDigits}` : '';

  const row = (k, v) => v ? `
    <tr>
      <td style="padding:10px 14px;font-family:ui-monospace,Menlo,monospace;font-size:11px;color:#5a6b7d;text-transform:uppercase;letter-spacing:.1em;width:32%;vertical-align:top;border-bottom:1px solid #ece7dc;">${k}</td>
      <td style="padding:10px 14px;color:#0a1929;font-size:14px;border-bottom:1px solid #ece7dc;">${v}</td>
    </tr>` : '';

  const phoneCell = lead.telefono
    ? `${escapeHtml(lead.telefono)}${waLink ? ` &nbsp;·&nbsp; <a href="${waLink}" style="color:#163b59;border-bottom:1px solid #ffb530;text-decoration:none;">Abrir WhatsApp →</a>` : ''}`
    : '';
  const emailCell = lead.email
    ? `<a href="mailto:${escapeHtml(lead.email)}" style="color:#163b59;border-bottom:1px solid #ffb530;text-decoration:none;">${escapeHtml(lead.email)}</a>`
    : '';

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="padding:24px 0;">
  <tr><td align="center">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="640" style="max-width:640px;background:#fafaf7;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.04);">
      <tr><td style="background:#163b59;padding:24px 28px;border-bottom:4px solid #ffb530;">
        <div style="font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:.22em;color:#ffb530;text-transform:uppercase;font-weight:600;">Nueva inscripción</div>
        <div style="color:#fafaf7;font-size:22px;margin-top:8px;font-weight:300;letter-spacing:-.01em;">${escapeHtml(fullName)}</div>
        <div style="color:rgba(244,241,234,.75);font-size:13px;margin-top:4px;">${escapeHtml(lead.course_name)}</div>
      </td></tr>
      <tr><td style="padding:8px 0 0;">
        <table style="width:100%;border-collapse:collapse;">
          ${row('Email', emailCell)}
          ${row('Teléfono', phoneCell)}
          ${row('Empresa', escapeHtml(lead.empresa))}
          ${row('Cargo', escapeHtml(lead.cargo))}
          ${row('Origen', escapeHtml(lead.origen))}
          ${row('Mensaje', escapeHtml(lead.mensaje).replace(/\n/g, '<br>'))}
          ${row('Lead ID', escapeHtml(lead.id))}
          ${row('Recibido', new Date(lead.created_at || Date.now()).toLocaleString('es-GT', { timeZone: 'America/Guatemala' }))}
        </table>
      </td></tr>
      <tr><td style="padding:18px 28px;background:#163b59;color:rgba(244,241,234,.6);font-family:ui-monospace,Menlo,monospace;font-size:10px;letter-spacing:.18em;text-transform:uppercase;text-align:center;">
        lambda Analytics · Responde a este correo para contactar al lead
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

  const text = [
    `Nueva inscripción · ${lead.course_name}`,
    '',
    `Nombre:    ${fullName}`,
    `Email:     ${lead.email || ''}`,
    `Teléfono:  ${lead.telefono || ''}`,
    `Empresa:   ${lead.empresa || ''}`,
    `Cargo:     ${lead.cargo || ''}`,
    `Origen:    ${lead.origen || ''}`,
    lead.mensaje ? `\nMensaje:\n${lead.mensaje}` : '',
    '',
    `Lead ID:   ${lead.id || ''}`,
    `Recibido:  ${new Date(lead.created_at || Date.now()).toISOString()}`,
  ].filter(Boolean).join('\n');

  const opts = {
    from: FROM,
    to: [ADMIN],
    subject,
    html,
    text,
  };
  if (lead.email && /\S+@\S+\.\S+/.test(lead.email)) {
    opts.replyTo = lead.email;
  }

  const { data, error } = await getResend().emails.send(opts);
  if (error) {
    console.error('[email] admin send failed:', error);
    throw new Error(error.message || 'Resend send failed');
  }
  return data;
}

/* =========================================================================
 * 2) Confirmación al lead
 * ========================================================================= */
export async function sendLeadConfirmation(lead) {
  if (!lead.email || !/\S+@\S+\.\S+/.test(lead.email)) return;

  const fullName = `${lead.nombre} ${lead.apellido}`.trim();
  const firstName = lead.nombre || fullName;
  const subject = `Recibimos tu solicitud · ${lead.course_name}`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="padding:24px 0;">
  <tr><td align="center">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:#fafaf7;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.04);">

      <!-- Header brand -->
      <tr><td style="background:#163b59;padding:28px 32px;border-bottom:4px solid #ffb530;">
        <div style="font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:.22em;color:#ffb530;text-transform:uppercase;font-weight:600;">LAMBDA ANALYTICS · Learn</div>
        <h1 style="color:#fafaf7;margin:8px 0 0;font-size:24px;font-weight:300;letter-spacing:-.01em;">Recibimos tu solicitud</h1>
      </td></tr>

      <!-- Greeting -->
      <tr><td style="padding:28px 32px 8px;">
        <p style="margin:0;color:#163b59;font-size:16px;">Hola <strong>${escapeHtml(firstName)}</strong>,</p>
        <p style="margin:12px 0 0;color:#555;font-size:14px;line-height:1.6;">
          Gracias por tu interés en <strong style="color:#163b59;">${escapeHtml(lead.course_name)}</strong>.
          Recibimos tus datos y un miembro de nuestro equipo se pondrá en contacto contigo
          en las próximas horas para confirmar tu cupo y compartir los métodos de pago.
        </p>
      </td></tr>

      <!-- Resumen del curso -->
      <tr><td style="padding:20px 32px;">
        <div style="background:#f4f1ea;border-left:3px solid #ffb530;padding:18px 22px;border-radius:4px;">
          <div style="font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:.16em;color:#163b59;text-transform:uppercase;font-weight:600;margin-bottom:10px;">Resumen del curso</div>
          <table style="width:100%;border-collapse:collapse;font-size:13.5px;color:#0a1929;">
            <tr><td style="padding:4px 0;color:#555;width:38%;">Curso:</td><td style="padding:4px 0;color:#163b59;font-weight:600;">${escapeHtml(lead.course_name)}</td></tr>
            <tr><td style="padding:4px 0;color:#555;">Modalidad:</td><td style="padding:4px 0;color:#163b59;">Virtual · vía Zoom</td></tr>
            <tr><td style="padding:4px 0;color:#555;">Duración:</td><td style="padding:4px 0;color:#163b59;">8 horas · 4 sesiones en vivo</td></tr>
            <tr><td style="padding:4px 0;color:#555;">Incluye:</td><td style="padding:4px 0;color:#163b59;">Materiales, plantillas y grabaciones de referencia</td></tr>
          </table>
        </div>
      </td></tr>

      <!-- Mientras tanto -->
      <tr><td style="padding:8px 32px 20px;">
        <p style="margin:0;color:#555;font-size:14px;line-height:1.6;">
          ¿Quieres adelantar la conversación? Escríbenos por WhatsApp y te respondemos al instante:
        </p>
      </td></tr>

      <!-- CTA -->
      <tr><td align="center" style="padding:0 32px 8px;">
        <a href="https://wa.me/50223010853?text=${encodeURIComponent('Hola, soy ' + fullName + '. Acabo de solicitar inscripción al curso "' + lead.course_name + '" y quisiera atención inmediata para reservar mi cupo.')}"
           style="display:inline-block;background:#163b59;color:#ffffff;padding:13px 32px;border-radius:4px;text-decoration:none;font-weight:600;font-size:14px;letter-spacing:.02em;">
          WhatsApp +502 2301-0853 →
        </a>
      </td></tr>

      <!-- Datos enviados -->
      <tr><td style="padding:28px 32px 8px;">
        <details style="font-size:13px;color:#5a6b7d;">
          <summary style="cursor:pointer;font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#163b59;">Datos que registramos</summary>
          <div style="padding:12px 0 0;line-height:1.7;">
            ${escapeHtml(fullName)}<br>
            ${escapeHtml(lead.email)}<br>
            ${escapeHtml(lead.telefono)}<br>
            ${escapeHtml(lead.empresa)} · ${escapeHtml(lead.cargo)}
          </div>
        </details>
      </td></tr>

      <!-- Footer -->
      <tr><td style="padding:24px 32px 28px;border-top:1px solid #ece7dc;">
        <p style="margin:0;color:#9ca3af;font-size:11px;line-height:1.5;">
          Este correo confirma la recepción de tu solicitud. No es confirmación de inscripción —
          el cupo se reserva cuando completes el pago.
          Si no fuiste tú quien envió esta solicitud, puedes ignorar este correo.
        </p>
        <p style="margin:12px 0 0;color:#9ca3af;font-size:11px;">
          lambda Analytics · Guatemala · learn@scilambda.net
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

  const text = [
    `Hola ${firstName},`,
    '',
    `Recibimos tu solicitud para "${lead.course_name}".`,
    'Un miembro del equipo se pondrá en contacto contigo en las próximas horas',
    'para confirmar tu cupo y compartir los métodos de pago.',
    '',
    '¿Quieres adelantar? WhatsApp: +502 2301-0853',
    '',
    '— lambda Analytics · learn@scilambda.net'
  ].join('\n');

  const { data, error } = await getResend().emails.send({
    from: FROM,
    to: [lead.email],
    subject,
    html,
    text,
  });
  if (error) {
    console.error('[email] lead confirmation send failed:', error);
    throw new Error(error.message || 'Resend send failed');
  }
  return data;
}
