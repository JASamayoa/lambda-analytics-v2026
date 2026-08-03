/**
 * Correos del RSVP de eventos vía Resend (reusa la misma cuenta/dominio que Learn).
 *
 *   - sendRsvpAdminNotification(data) → notificación interna a soluciones@scilambda.net
 *   - sendRsvpConfirmation(data)      → confirmación al participante
 *
 * Paleta brand: --navy:#163b59 --navy-deep:#0d2640 --gold:#ffb530
 */
import { Resend } from 'resend';

let resend;
function getResend() {
  if (!resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY no está configurada. Ver DEPLOY-RSVP.md.');
    }
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

// Remitente: cualquier dirección @scilambda.net funciona (dominio ya verificado en Resend).
const FROM  = process.env.RSVP_FROM  || 'LAMBDA Analytics <eventos@scilambda.net>';
// Destinatario interno del RSVP.
const ADMIN = process.env.RSVP_ADMIN_EMAIL || 'soluciones@scilambda.net';

// Detalles del evento (fuente única de verdad para los correos).
export const EVENT = {
  name:     'The AI Edge — Claude for Decision Makers',
  tagline:  'Desayuno ejecutivo + taller de Claude · Del insight a la acción',
  fecha:    'Viernes 21 de agosto, 2026',
  horario:  '9:00 – 11:00 AM',
  lugar:    'Pecorino · Zona 10, Ciudad de Guatemala',
  formato:  'Solo por invitación · Cupo personal',
  slug:     'the-ai-edge',
};

function escapeHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function attendLabel(attending) {
  return attending === 'no' ? 'No podrá asistir' : 'Confirma asistencia';
}

function guestsHtml(guests) {
  if (!Array.isArray(guests) || guests.length === 0) return '';
  const items = guests
    .filter(g => g && (g.nombre || g.email))
    .map(g => `<li style="margin:4px 0;color:#0a1929;font-size:14px;">
        ${escapeHtml(g.nombre || '(sin nombre)')}${g.email ? ` &nbsp;·&nbsp; <span style="color:#5a6b7d;">${escapeHtml(g.email)}</span>` : ''}
      </li>`)
    .join('');
  return items ? `<ul style="margin:6px 0 0;padding-left:18px;">${items}</ul>` : '';
}

/* Bloque reutilizable con los detalles del evento (HTML) */
function eventCardHtml() {
  const row = (k, v) => `
    <tr>
      <td style="padding:5px 0;color:#5a6b7d;width:34%;font-size:13.5px;">${k}</td>
      <td style="padding:5px 0;color:#163b59;font-size:13.5px;font-weight:600;">${v}</td>
    </tr>`;
  return `
  <div style="background:#f4f1ea;border-left:3px solid #ffb530;padding:18px 22px;border-radius:4px;">
    <div style="font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:.16em;color:#163b59;text-transform:uppercase;font-weight:600;margin-bottom:10px;">Detalles del evento</div>
    <div style="color:#0a1929;font-size:15px;font-weight:600;margin-bottom:8px;">${escapeHtml(EVENT.name)}</div>
    <table style="width:100%;border-collapse:collapse;">
      ${row('Fecha', escapeHtml(EVENT.fecha))}
      ${row('Horario', escapeHtml(EVENT.horario))}
      ${row('Lugar', escapeHtml(EVENT.lugar))}
      ${row('Formato', escapeHtml(EVENT.formato))}
    </table>
  </div>`;
}

/* =========================================================================
 * 1) Notificación interna → soluciones@scilambda.net
 * ========================================================================= */
export async function sendRsvpAdminNotification(data) {
  const subject = `RSVP · ${EVENT.name} · ${data.nombre} · ${attendLabel(data.attending)}`;
  const phoneDigits = (data.telefono || '').replace(/[^0-9]/g, '');
  const waLink = phoneDigits ? `https://wa.me/${phoneDigits}` : '';

  const row = (k, v) => v ? `
    <tr>
      <td style="padding:10px 14px;font-family:ui-monospace,Menlo,monospace;font-size:11px;color:#5a6b7d;text-transform:uppercase;letter-spacing:.1em;width:32%;vertical-align:top;border-bottom:1px solid #ece7dc;">${k}</td>
      <td style="padding:10px 14px;color:#0a1929;font-size:14px;border-bottom:1px solid #ece7dc;">${v}</td>
    </tr>` : '';

  const emailCell = data.email
    ? `<a href="mailto:${escapeHtml(data.email)}" style="color:#163b59;border-bottom:1px solid #ffb530;text-decoration:none;">${escapeHtml(data.email)}</a>` : '';
  const phoneCell = data.telefono
    ? `${escapeHtml(data.telefono)}${waLink ? ` &nbsp;·&nbsp; <a href="${waLink}" style="color:#163b59;border-bottom:1px solid #ffb530;text-decoration:none;">WhatsApp →</a>` : ''}` : '';
  const attendCell = data.attending === 'no'
    ? `<span style="color:#b4232a;font-weight:600;">No podrá asistir</span>`
    : `<span style="color:#1a7a3c;font-weight:600;">Confirma asistencia ✓</span>`;
  const guestsBlock = guestsHtml(data.suggested_guests);

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="padding:24px 0;">
  <tr><td align="center">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="640" style="max-width:640px;background:#fafaf7;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.04);">
      <tr><td style="background:#163b59;padding:24px 28px;border-bottom:4px solid #ffb530;">
        <div style="font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:.22em;color:#ffb530;text-transform:uppercase;font-weight:600;">Nuevo RSVP · ${escapeHtml(EVENT.slug)}</div>
        <div style="color:#fafaf7;font-size:22px;margin-top:8px;font-weight:300;letter-spacing:-.01em;">${escapeHtml(data.nombre)}</div>
        <div style="color:rgba(244,241,234,.75);font-size:13px;margin-top:4px;">${escapeHtml(EVENT.name)}</div>
      </td></tr>
      <tr><td style="padding:8px 0 0;">
        <table style="width:100%;border-collapse:collapse;">
          ${row('Asistencia', attendCell)}
          ${row('Email', emailCell)}
          ${row('Teléfono', phoneCell)}
          ${row('Empresa', escapeHtml(data.empresa))}
          ${row('Invitados sugeridos', guestsBlock || '<span style="color:#9ca3af;">— ninguno —</span>')}
          ${row('Código', escapeHtml(data.code))}
          ${row('Response ID', escapeHtml(data.responseId))}
          ${row('Recibido', new Date(data.created_at || Date.now()).toLocaleString('es-GT', { timeZone: 'America/Guatemala' }))}
        </table>
      </td></tr>
      <tr><td style="padding:18px 28px;background:#163b59;color:rgba(244,241,234,.6);font-family:ui-monospace,Menlo,monospace;font-size:10px;letter-spacing:.18em;text-transform:uppercase;text-align:center;">
        LAMBDA Analytics · Responde a este correo para contactar al invitado
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

  const guestsText = (Array.isArray(data.suggested_guests) ? data.suggested_guests : [])
    .filter(g => g && (g.nombre || g.email))
    .map(g => `  - ${g.nombre || '(sin nombre)'}${g.email ? ' · ' + g.email : ''}`)
    .join('\n');

  const text = [
    `Nuevo RSVP · ${EVENT.name}`,
    '',
    `Nombre:      ${data.nombre}`,
    `Asistencia:  ${attendLabel(data.attending)}`,
    `Email:       ${data.email || ''}`,
    `Teléfono:    ${data.telefono || ''}`,
    `Empresa:     ${data.empresa || ''}`,
    `Código:      ${data.code || ''}`,
    '',
    'Invitados sugeridos:',
    guestsText || '  (ninguno)',
    '',
    `Response ID: ${data.responseId || ''}`,
    `Recibido:    ${new Date(data.created_at || Date.now()).toISOString()}`,
  ].join('\n');

  const opts = { from: FROM, to: [ADMIN], subject, html, text };
  if (data.email && /\S+@\S+\.\S+/.test(data.email)) opts.replyTo = data.email;

  const { data: sent, error } = await getResend().emails.send(opts);
  if (error) { console.error('[rsvp-email] admin send failed:', error); throw new Error(error.message || 'Resend send failed'); }
  return sent;
}

/* =========================================================================
 * 2) Confirmación al participante
 * ========================================================================= */
export async function sendRsvpConfirmation(data) {
  if (!data.email || !/\S+@\S+\.\S+/.test(data.email)) return;

  const firstName = (data.nombre || '').split(' ')[0] || data.nombre;
  const declined = data.attending === 'no';
  const subject = declined
    ? `Gracias por avisarnos · ${EVENT.name}`
    : `Confirmado · ${EVENT.name}`;

  const guestsBlock = guestsHtml(data.suggested_guests);
  const guestsNote = guestsBlock ? `
      <tr><td style="padding:4px 32px 20px;">
        <div style="background:#fafaf7;border:1px solid #ece7dc;padding:16px 20px;border-radius:4px;">
          <div style="font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:.14em;color:#163b59;text-transform:uppercase;font-weight:600;margin-bottom:8px;">Invitado(s) que sugirió</div>
          ${guestsBlock}
          <p style="margin:10px 0 0;color:#5a6b7d;font-size:12.5px;line-height:1.5;">
            Nuestro equipo evaluará su potencial participación y, de proceder, le haremos llegar una invitación personal.
          </p>
        </div>
      </td></tr>` : '';

  const intro = declined
    ? `Lamentamos que no pueda acompañarnos en <strong style="color:#163b59;">${escapeHtml(EVENT.name)}</strong>. Gracias por tomarse el tiempo de avisarnos. Nos encantaría contar con usted en una próxima edición.`
    : `Es un gusto confirmarle para <strong style="color:#163b59;">${escapeHtml(EVENT.name)}</strong>. Reservamos su lugar en este encuentro exclusivo por invitación. A continuación los detalles:`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="padding:24px 0;">
  <tr><td align="center">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:#fafaf7;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.04);">

      <tr><td style="background:#163b59;padding:28px 32px;border-bottom:4px solid #ffb530;">
        <div style="font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:.22em;color:#ffb530;text-transform:uppercase;font-weight:600;">LAMBDA ANALYTICS</div>
        <h1 style="color:#fafaf7;margin:8px 0 0;font-size:24px;font-weight:300;letter-spacing:-.01em;">${declined ? 'Gracias por avisarnos' : 'Su lugar está confirmado'}</h1>
      </td></tr>

      <tr><td style="padding:28px 32px 8px;">
        <p style="margin:0;color:#163b59;font-size:16px;">Hola <strong>${escapeHtml(firstName)}</strong>,</p>
        <p style="margin:12px 0 0;color:#555;font-size:14px;line-height:1.6;">${intro}</p>
      </td></tr>

      ${declined ? '' : `<tr><td style="padding:20px 32px;">${eventCardHtml()}</td></tr>`}

      ${guestsNote}

      <tr><td style="padding:8px 32px 20px;">
        <details style="font-size:13px;color:#5a6b7d;">
          <summary style="cursor:pointer;font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#163b59;">Datos que registramos</summary>
          <div style="padding:12px 0 0;line-height:1.7;">
            ${escapeHtml(data.nombre)}<br>
            ${escapeHtml(data.email)}<br>
            ${escapeHtml(data.telefono || '')}${data.telefono ? '<br>' : ''}
            ${escapeHtml(data.empresa || '')}
          </div>
        </details>
      </td></tr>

      <tr><td style="padding:24px 32px 28px;border-top:1px solid #ece7dc;">
        <p style="margin:0;color:#9ca3af;font-size:11px;line-height:1.5;">
          Este encuentro es solo por invitación y de cupo personal.
          Si necesita ajustar su respuesta, escríbanos a soluciones@scilambda.net.
          Si no fue usted quien envió esta confirmación, puede ignorar este correo.
        </p>
        <p style="margin:12px 0 0;color:#9ca3af;font-size:11px;">
          LAMBDA Analytics · Guatemala · soluciones@scilambda.net · Transforming Data into Insights
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

  const text = [
    `Hola ${firstName},`,
    '',
    declined
      ? `Gracias por avisarnos que no podrá asistir a "${EVENT.name}". Esperamos contar con usted en una próxima edición.`
      : `Su lugar está confirmado para "${EVENT.name}".`,
    '',
    ...(declined ? [] : [
      'Detalles del evento:',
      `  Fecha:   ${EVENT.fecha}`,
      `  Horario: ${EVENT.horario}`,
      `  Lugar:   ${EVENT.lugar}`,
      `  Formato: ${EVENT.formato}`,
      '',
    ]),
    '— LAMBDA Analytics · soluciones@scilambda.net',
  ].join('\n');

  const { data: sent, error } = await getResend().emails.send({
    from: FROM, to: [data.email], subject, html, text,
  });
  if (error) { console.error('[rsvp-email] confirmation send failed:', error); throw new Error(error.message || 'Resend send failed'); }
  return sent;
}
