/**
 * Aplica los archivos SQL de la carpeta /sql en orden alfabético contra DATABASE_URL.
 *
 * Uso:
 *   DATABASE_URL="postgresql://..." node scripts/run-migration.js
 *
 * Idempotente: todos los CREATE usan IF NOT EXISTS, así que se puede correr varias veces.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SQL_DIR = join(__dirname, '..', 'sql');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('✗ DATABASE_URL no está definida.');
    console.error('  Ejemplo: DATABASE_URL="postgresql://..." node scripts/run-migration.js');
    process.exit(1);
  }

  const files = readdirSync(SQL_DIR).filter(f => f.endsWith('.sql')).sort();
  if (!files.length) {
    console.log('No hay archivos .sql en /sql');
    return;
  }

  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log('✓ Conectado a Neon');

  for (const file of files) {
    const sql = readFileSync(join(SQL_DIR, file), 'utf8');
    console.log(`\n▶ Ejecutando ${file}…`);
    try {
      await client.query(sql);
      console.log(`✓ ${file} aplicado`);
    } catch (err) {
      console.error(`✗ Error en ${file}:`, err.message);
      await client.end();
      process.exit(1);
    }
  }

  // Verificación rápida
  const { rows } = await client.query("SELECT COUNT(*)::int AS n FROM leads");
  console.log(`\n✓ Migración completa. Tabla leads tiene ${rows[0].n} registros.`);

  await client.end();
}

main().catch(err => {
  console.error('Migración falló:', err);
  process.exit(1);
});
