/**
 * Pool de conexiones a Neon Postgres.
 *
 * En entorno serverless (Vercel Functions) cada invocación corre en
 * un container que puede reutilizarse o no. Mantenemos un pool global
 * para que se reuse mientras el container vive.
 *
 * Usar siempre `await query(...)` y dejar que el pool maneje conexiones.
 */
import pg from 'pg';

const { Pool } = pg;

// Variable global para reutilizar el pool entre invocaciones tibias
// (Vercel mantiene el container vivo unos segundos después de la última request).
let pool;

function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL no está configurada. Revisar variables de entorno en Vercel.');
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // Neon requiere SSL. El query string ya incluye sslmode=require pero forzamos por seguridad.
      ssl: { rejectUnauthorized: false },
      // En serverless conviene pool pequeño: cada container atiende 1 request a la vez normalmente.
      max: 3,
      // Cerrar conexiones idle rápido para no agotar el cap de Neon.
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });

    pool.on('error', (err) => {
      console.error('[db] Pool error:', err);
    });
  }
  return pool;
}

/**
 * Ejecuta una query parametrizada. Retorna { rows, rowCount }.
 *
 *   const { rows } = await query('SELECT * FROM leads WHERE email = $1', [email]);
 */
export async function query(text, params = []) {
  const start = Date.now();
  try {
    const result = await getPool().query(text, params);
    const ms = Date.now() - start;
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[db] ${text.slice(0, 80).replace(/\s+/g, ' ')}… (${ms}ms, ${result.rowCount} rows)`);
    }
    return result;
  } catch (err) {
    console.error('[db] Query failed:', text.slice(0, 200), 'params:', params, 'error:', err.message);
    throw err;
  }
}

/**
 * Inserta un lead nuevo. Retorna el row insertado con su id.
 * No deduplica — los duplicados se marcan después por workflow comercial.
 */
export async function insertLead(lead) {
  const sql = `
    INSERT INTO leads (
      course_slug, course_name,
      nombre, apellido, email, telefono, empresa, cargo, origen, mensaje,
      utm_source, utm_medium, utm_campaign, utm_term, utm_content,
      referrer, landing_path, ip, user_agent
    ) VALUES (
      $1, $2,
      $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15,
      $16, $17, $18, $19
    )
    RETURNING id, created_at
  `;
  const values = [
    lead.course_slug, lead.course_name,
    lead.nombre, lead.apellido, lead.email, lead.telefono, lead.empresa, lead.cargo, lead.origen || null, lead.mensaje || null,
    lead.utm_source || null, lead.utm_medium || null, lead.utm_campaign || null, lead.utm_term || null, lead.utm_content || null,
    lead.referrer || null, lead.landing_path || null, lead.ip || null, lead.user_agent || null
  ];
  const { rows } = await query(sql, values);
  return rows[0]; // { id, created_at }
}
