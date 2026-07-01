/**
 * POST /api/rsvp
 *
 * Recibe el RSVP, lo persiste de forma atómica (single-use del código) y
 * dispara dos correos: confirmación al participante + notificación a
 * soluciones@scilambda.net.
 *
 * Body (JSON):
 *   {
 *     code, event_slug?,
 *     email (obligatorio), telefono?, empresa?,
 *     attending: 'yes' | 'no',
 *     suggested_guests: [{ nombre, email }],
 *     website? (honeypot)
 *   }
 * El nombre NO viene del cliente: se toma del invitado precargado en DB
 * (evita manipulación del nombre del código).
 */
import { submitRsvp } from '../lib/rsvp-db.js';
import { sendRsvpAdminNotification, sendRsvpConfirmation, EVENT } from '../lib/rsvp-email.js';

const MAX_LEN = 500;
const MAX_GUESTS = 10;

function badRequest(res, msg, details) {
  return res.status(400).json({ ok: false, error: msg, details });
}
function clean(v, max = MAX_LEN) {
  return typeof v === 'string' ? v.trim().slice(0, max) : null;
}
function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string') return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || null;
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return badRequest(res, 'Body no es JSON válido'); }
  }
  if (!body || typeof body !== 'object') return badRequest(res, 'Body vacío o inválido');

  // Honeypot anti-spam
  if (body.website || body.url || body.fax) {
    return res.status(200).json({ ok: true, spam: true });
  }

  const code = clean(body.code, 80);
  if (!code) return badRequest(res, 'Código requerido');

  const email = clean(body.email);
  if (!email || !EMAIL_RE.test(email)) return badRequest(res, 'Correo electrónico válido es obligatorio');

  const attending = body.attending === 'no' ? 'no' : 'yes';

  // Normalizar invitados sugeridos: array de { nombre, email }
  let guests = [];
  if (Array.isArray(body.suggested_guests)) {
    guests = body.suggested_guests
      .map(g => ({
        nombre: clean(g && g.nombre, 200) || '',
        email:  clean(g && g.email, 200) || '',
      }))
      .filter(g => g.nombre || g.email)          // descarta filas vacías
      .filter(g => !g.email || EMAIL_RE.test(g.email)) // descarta emails inválidos
      .slice(0, MAX_GUESTS);
  }

  const eventSlug = clean(body.event_slug, 80) || EVENT.slug;

  const payload = {
    code,
    event_slug: eventSlug,
    event_name: EVENT.name,
    email: email.toLowerCase(),
    telefono: clean(body.telefono),
    empresa: clean(body.empresa),
    attending,
    suggested_guests: guests,
    ip: getClientIp(req),
    user_agent: clean(req.headers['user-agent']),
    nombre: null, // se completa desde DB
  };

  // 1) Persistir (transacción single-use). El nombre real lo devuelve la DB.
  let saved;
  try {
    // Nombre temporal: la función usa el nombre precargado del invitado para la inserción.
    // Pasamos el nombre del invitado tras leerlo dentro de la transacción.
    saved = await submitRsvp({ ...payload, nombre: clean(body.nombre) || 'Invitado' });
  } catch (err) {
    if (err.code === 'INVALID_CODE') {
      return res.status(404).json({ ok: false, reason: 'invalid', error: 'Código no válido.' });
    }
    if (err.code === 'ALREADY_USED') {
      return res.status(409).json({ ok: false, reason: 'used', error: 'Este código ya fue utilizado.' });
    }
    console.error('[api/rsvp] DB error:', err);
    return res.status(500).json({ ok: false, error: 'No pudimos registrar tu respuesta. Intenta de nuevo o escríbenos a soluciones@scilambda.net' });
  }

  // Nombre autoritativo = el precargado del invitado en DB
  const authoritativeName = saved.invitee?.nombre || clean(body.nombre) || 'Invitado';

  const emailData = {
    ...payload,
    nombre: authoritativeName,
    responseId: saved.responseId,
    created_at: saved.created_at,
  };

  // 2) Correos en paralelo (no bloquean la respuesta; el RSVP ya está guardado)
  const [adminRes, guestRes] = await Promise.allSettled([
    sendRsvpAdminNotification(emailData),
    sendRsvpConfirmation(emailData),
  ]);
  if (adminRes.status === 'rejected') console.error('[api/rsvp] Admin email failed:', adminRes.reason);
  if (guestRes.status === 'rejected') console.error('[api/rsvp] Guest email failed:', guestRes.reason);

  return res.status(200).json({
    ok: true,
    id: saved.responseId,
    attending,
    nombre: authoritativeName,
    emails: {
      admin: adminRes.status === 'fulfilled',
      guest: guestRes.status === 'fulfilled',
    },
  });
}
