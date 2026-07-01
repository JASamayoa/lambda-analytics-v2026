/**
 * Generador de códigos personales de invitación para el RSVP.
 *
 * Lee una lista de invitados desde un archivo de texto (uno por línea):
 *
 *     Nombre Completo | Empresa (opcional) | correo (opcional)
 *
 * Ejemplo (data/invitees.txt):
 *     Ana López | Corporación XYZ | ana@xyz.com
 *     Carlos Méndez | Grupo ABC
 *     María Fernández
 *
 * Genera para cada invitado un código único de alta entropía (formato XXXX-XXXX)
 * y produce DOS salidas en la carpeta /scripts/out:
 *
 *   1. rsvp-codes.csv  → nombre,empresa,email,codigo,link   (para saber qué mandar a cada quien)
 *   2. 003_seed_rsvp_invitees.sql → INSERTs listos para correr contra Neon
 *
 * Uso:
 *   node scripts/gen-rsvp-codes.js data/invitees.txt
 *   node scripts/gen-rsvp-codes.js data/invitees.txt --event the-ai-edge --base https://rsvp.lambda-analytics.net
 *
 * Luego aplicar el SQL:
 *   DATABASE_URL="postgresql://..." psql "$DATABASE_URL" -f scripts/out/003_seed_rsvp_invitees.sql
 *   (o pegarlo en el SQL Editor de Neon)
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import crypto from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---- args ----
const args = process.argv.slice(2);
const inputPath = args.find(a => !a.startsWith('--'));
function argVal(flag, def){ const i = args.indexOf(flag); return i >= 0 && args[i+1] ? args[i+1] : def; }
const EVENT_SLUG = argVal('--event', 'the-ai-edge');
const BASE_URL   = argVal('--base', 'https://rsvp.lambda-analytics.net');

if(!inputPath){
  console.error('✗ Falta el archivo de invitados.');
  console.error('  Uso: node scripts/gen-rsvp-codes.js data/invitees.txt [--event the-ai-edge] [--base https://rsvp.lambda-analytics.net]');
  process.exit(1);
}

// ---- código sin caracteres ambiguos (sin 0/O/1/I/L) ----
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function genCode(){
  const pick = n => Array.from({length:n}, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join('');
  return pick(4) + '-' + pick(4); // 8 chars → ~40 bits, imposible de adivinar
}
function sqlEsc(s){ return s == null ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`; }

// ---- parse ----
const raw = readFileSync(inputPath, 'utf8');
const lines = raw.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));

const seen = new Set();
const rows = [];
for(const line of lines){
  const [nombre, empresa, email] = line.split('|').map(s => (s||'').trim());
  if(!nombre) continue;
  let code;
  do { code = genCode(); } while(seen.has(code));
  seen.add(code);
  rows.push({ nombre, empresa: empresa||'', email: email||'', code });
}

if(rows.length === 0){
  console.error('✗ No se encontraron invitados válidos en', inputPath);
  process.exit(1);
}

// ---- salidas ----
const outDir = join(__dirname, 'out');
if(!existsSync(outDir)) mkdirSync(outDir, { recursive:true });

// CSV
const csvHeader = 'nombre,empresa,email,codigo,link';
const csvLines = rows.map(r => {
  const link = `${BASE_URL.replace(/\/$/,'')}/the-ai-edge`;
  const cell = v => `"${String(v||'').replace(/"/g,'""')}"`;
  return [cell(r.nombre), cell(r.empresa), cell(r.email), cell(r.code), cell(link)].join(',');
});
const csvPath = join(outDir, 'rsvp-codes.csv');
writeFileSync(csvPath, [csvHeader, ...csvLines].join('\n') + '\n', 'utf8');

// SQL
const sqlValues = rows.map(r =>
  `  (${sqlEsc(EVENT_SLUG)}, ${sqlEsc(r.code)}, ${sqlEsc(r.nombre)}, ${sqlEsc(r.empresa||null)}, ${sqlEsc(r.email||null)})`
).join(',\n');
const sql = `-- Seed de invitados RSVP · evento: ${EVENT_SLUG}
-- Generado ${new Date().toISOString()} · ${rows.length} invitados
-- Aplicar: psql "$DATABASE_URL" -f scripts/out/003_seed_rsvp_invitees.sql
-- ON CONFLICT: si el código ya existe, no lo duplica.

INSERT INTO rsvp_invitees (event_slug, code, nombre, empresa, email) VALUES
${sqlValues}
ON CONFLICT (event_slug, LOWER(code)) DO NOTHING;
`;
const sqlPath = join(outDir, '003_seed_rsvp_invitees.sql');
writeFileSync(sqlPath, sql, 'utf8');

console.log(`✓ ${rows.length} invitados procesados.`);
console.log(`  CSV (nombre↔código): ${csvPath}`);
console.log(`  SQL seed:            ${sqlPath}`);
console.log('');
console.log('Siguiente paso: aplicar el SQL en Neon y compartir a cada invitado su link + código del CSV.');
