/**
 * POST /api/lead
 *
 * Recibe el formulario de inscripción, persiste el lead en Neon Postgres
 * y dispara dos correos: notificación interna + confirmación al lead.
 *
 * Vercel Serverless Function · runtime Node.js (default).
 *
 * Body esperado (JSON):
 *   {
 *     course_slug:  'ia-rrhh',
 *     course_name:  'IA aplicada a RRHH y Gestión del Talento - Junio 2026',
 *     nombre, apellido, email, telefono, empresa, cargo,
 *     origen, mensaje,
 *     utm_source?, utm_medium?, utm_campaign?, utm_term?, utm_content?,
 *     referrer?, landing_path?
 *   }
 */
import { insertLead } from '../lib/db.js';
import { sendAdminNotification, sendLeadConfirmation } from '../lib/email.js';

// Campos que el form DEBE incluir
const REQUIRED = ['course_slug', 'course_name', 'nombre', 'apellido', 'email', 'telefono', 'empresa', 'cargo'];
const MAX_LEN = 500;       // longitud máxima por campo string
const MAX_MSG_LEN = 2000;  // mensaje opcional puede ser más largo

function badRequest(res, msg, details) {
  res.status(400).json({ ok: false, error: msg, details });
}

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string') return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || null;
}

export default async function handler(req, res) {
  // Solo POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  // Parseo defensivo
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return badRequest(res, 'Body no es JSON válido'); }
  }
  if (!body || typeof body !== 'object') {
    return badRequest(res, 'Body vacío o inválido');
  }

  // Honeypot: si el bot llena este campo invisible, cortamos sin error visible
  if (body.website || body.url || body.fax) {
    return res.status(200).json({ ok: true, spam: true });
  }

  // Validación de requeridos + tamaños
  const missing = REQUIRED.filter(k => !body[k] || String(body[k]).trim().length === 0);
  if (missing.length) {
    return badRequest(res, 'Campos requeridos faltantes', { missing });
  }

  // Validación básica de email
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(body.email).trim())) {
    return badRequest(res, 'Email inválido');
  }

  // Truncar para evitar payloads gigantes
  function clean(v, max = MAX_LEN) {
    return typeof v === 'string' ? v.trim().slice(0, max) : null;
  }

  const lead = {
    course_slug:  clean(body.course_slug),
    course_name:  clean(body.course_name),
    nombre:       clean(body.nombre),
    apellido:     clean(body.apellido),
    email:        clean(body.email).toLowerCase(),
    telefono:     clean(body.telefono),
    empresa:      clean(body.empresa),
    cargo:        clean(body.cargo),
    origen:       clean(body.origen),
    mensaje:      clean(body.mensaje, MAX_MSG_LEN),
    utm_source:   clean(body.utm_source),
    utm_medium:   clean(body.utm_medium),
    utm_campaign: clean(body.utm_campaign),
    utm_term:     clean(body.utm_term),
    utm_content:  clean(body.utm_content),
    referrer:     clean(body.referrer),
    landing_path: clean(body.landing_path),
    ip:           getClientIp(req),
    user_agent:   clean(req.headers['user-agent']),
  };

  // 1) Persistir en DB
  let saved;
  try {
    saved = await insertLead(lead);
  } catch (err) {
    console.error('[api/lead] DB error:', err);
    return res.status(500).json({ ok: false, error: 'No pudimos guardar tu solicitud. Intenta de nuevo o escríbenos a learn@scilambda.net' });
  }

  const leadWithId = { ...lead, id: saved.id, created_at: saved.created_at };

  // 2) Enviar correos (en paralelo). No bloqueamos la respuesta si falla email —
  //    el lead ya está en DB, lo importante es persistirlo.
  const [adminRes, leadRes] = await Promise.allSettled([
    sendAdminNotification(leadWithId),
    sendLeadConfirmation(leadWithId),
  ]);
  if (adminRes.status === 'rejected') console.error('[api/lead] Admin email failed:', adminRes.reason);
  if (leadRes.status === 'rejected')  console.error('[api/lead] Lead email failed:',  leadRes.reason);

  return res.status(200).json({
    ok: true,
    id: saved.id,
    emails: {
      admin: adminRes.status === 'fulfilled',
      lead:  leadRes.status === 'fulfilled',
    }
  });
}
