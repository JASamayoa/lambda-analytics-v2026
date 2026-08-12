/**
 * POST /api/rsvp-verify
 *
 * Valida un código personal de invitación y devuelve el nombre precargado
 * para el formulario de RSVP. No modifica nada (idempotente).
 *
 * Body: { code: string, event_slug?: string }
 * Respuestas:
 *   200 { ok:true,  nombre, empresa, used:false }   → código válido y disponible
 *   200 { ok:false, reason:'used' }                 → ya fue utilizado
 *   200 { ok:false, reason:'invalid' }              → no existe
 */
import { getInviteeByCode } from '../lib/rsvp-db.js';

const EVENT_SLUG = 'the-ai-edge';

// Normaliza el código: ignora espacios, mayúsculas/minúsculas y el guion.
// "mskq uuk7" | "MSKQUUK7" | "MSKQ-UUK7" -> "MSKQ-UUK7"
function normalizeCode(raw) {
  const s = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return s.length === 8 ? s.slice(0, 4) + '-' + s.slice(4) : s;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ ok: false, error: 'Body no es JSON válido' }); }
  }
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ ok: false, error: 'Body vacío o inválido' });
  }

  const code = normalizeCode(body.code);
  const eventSlug = typeof body.event_slug === 'string' && body.event_slug.trim() ? body.event_slug.trim() : EVENT_SLUG;

  if (!code || code.length > 80) {
    return res.status(400).json({ ok: false, error: 'Código requerido' });
  }

  let invitee;
  try {
    invitee = await getInviteeByCode(code, eventSlug);
  } catch (err) {
    console.error('[api/rsvp-verify] DB error:', err);
    return res.status(500).json({ ok: false, error: 'No pudimos validar tu código. Intenta de nuevo o escríbenos a soluciones@scilambda.net' });
  }

  if (!invitee) {
    return res.status(200).json({ ok: false, reason: 'invalid' });
  }
  if (invitee.used) {
    return res.status(200).json({ ok: false, reason: 'used' });
  }

  return res.status(200).json({
    ok: true,
    nombre: invitee.nombre,
    empresa: invitee.empresa || '',
    email: invitee.email || '',
  });
}
