/**
 * Helpers de DB para el RSVP de eventos (invitación only).
 *
 * Reusa el mismo pool de Neon que los leads de cursos (lib/db.js) — no crea
 * un servicio nuevo, solo tablas nuevas dentro de la misma base.
 */
import pg from 'pg';
import { query } from './db.js';

/**
 * Busca un invitado por su código personal (case-insensitive) dentro de un evento.
 * Retorna el row o null. NO marca nada como usado — eso ocurre al enviar el RSVP.
 */
export async function getInviteeByCode(code, eventSlug = 'the-ai-edge') {
  const sql = `
    SELECT id, code, event_slug, nombre, empresa, email, used, responded_at
    FROM rsvp_invitees
    WHERE event_slug = $1 AND LOWER(code) = LOWER($2)
    LIMIT 1
  `;
  const { rows } = await query(sql, [eventSlug, code]);
  return rows[0] || null;
}

/**
 * Registra la respuesta de RSVP de forma atómica y single-use.
 *
 * En una sola transacción:
 *   1. Bloquea la fila del invitado (SELECT ... FOR UPDATE).
 *   2. Verifica que el código no haya sido usado.
 *   3. Inserta la respuesta.
 *   4. Marca el código como usado (used = true, responded_at = now()).
 *
 * Lanza errores con .code para que el endpoint responda con el mensaje correcto:
 *   - 'INVALID_CODE'  → el código no existe
 *   - 'ALREADY_USED'  → el código ya fue utilizado
 *
 * Retorna { responseId, created_at, invitee }.
 */
export async function submitRsvp(payload) {
  const {
    code,
    event_slug = 'the-ai-edge',
    event_name = null,
    nombre,
    email,
    telefono = null,
    empresa = null,
    attending = 'yes',
    suggested_guests = [],
    ip = null,
    user_agent = null,
  } = payload;

  // Necesitamos una conexión dedicada para la transacción (no el helper query()).
  const pool = getPoolFromDb();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const inviteeRes = await client.query(
      `SELECT id, nombre, empresa, used
         FROM rsvp_invitees
        WHERE event_slug = $1 AND LOWER(code) = LOWER($2)
        FOR UPDATE`,
      [event_slug, code]
    );

    if (inviteeRes.rowCount === 0) {
      const err = new Error('Código no encontrado');
      err.code = 'INVALID_CODE';
      throw err;
    }

    const invitee = inviteeRes.rows[0];
    if (invitee.used) {
      const err = new Error('El código ya fue utilizado');
      err.code = 'ALREADY_USED';
      throw err;
    }

    // Nombre autoritativo: el precargado del invitado, NO el que envía el cliente.
    const nombreAutoritativo = invitee.nombre || nombre;

    const insertRes = await client.query(
      `INSERT INTO rsvp_responses (
         invitee_id, code, event_slug, event_name,
         nombre, email, telefono, empresa,
         attending, suggested_guests, ip, user_agent
       ) VALUES (
         $1, $2, $3, $4,
         $5, $6, $7, $8,
         $9, $10::jsonb, $11, $12
       )
       RETURNING id, created_at`,
      [
        invitee.id, code, event_slug, event_name,
        nombreAutoritativo, email, telefono, empresa,
        attending, JSON.stringify(suggested_guests || []), ip, user_agent,
      ]
    );

    await client.query(
      `UPDATE rsvp_invitees
          SET used = TRUE, responded_at = NOW()
        WHERE id = $1`,
      [invitee.id]
    );

    await client.query('COMMIT');

    return {
      responseId: insertRes.rows[0].id,
      created_at: insertRes.rows[0].created_at,
      invitee: { id: invitee.id, nombre: invitee.nombre, empresa: invitee.empresa },
    };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* noop */ }
    throw err;
  } finally {
    client.release();
  }
}

/* -------------------------------------------------------------------------
 * Acceso al pool.
 * lib/db.js no exporta el pool directamente (solo query/insertLead). Para la
 * transacción abrimos un pool propio con la misma configuración/conn string.
 * Es un pool liviano (max 2) reutilizado entre invocaciones tibias.
 * ----------------------------------------------------------------------- */
let rsvpPool;
function getPoolFromDb() {
  if (!rsvpPool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL no está configurada.');
    }
    rsvpPool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 2,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
    rsvpPool.on('error', (e) => console.error('[rsvp-db] Pool error:', e));
  }
  return rsvpPool;
}
