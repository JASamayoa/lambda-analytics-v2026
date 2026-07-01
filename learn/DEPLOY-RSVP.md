# RSVP · The AI Edge — guía de deploy

Sistema de confirmación de asistencia (invitación only) para el evento
**The AI Edge — Claude for Decision Makers** (24 jul 2026, Pecorino Zona 10).

Reutiliza **la misma infra** que los cursos de RRHH: base **Neon Postgres** + correo
**Resend**, dentro del proyecto Vercel `lambda-learn`. **No** se crea ningún servicio nuevo.

---

## Arquitectura

```
PDF / invitación
      │  link → https://rsvp.lambda-analytics.net  (→ redirige a /the-ai-edge)
      ▼
the-ai-edge/index.html
      │  header LAMBDA ANALYTICS + modal "Ingrese su código personal"
      │
      ├── POST /api/rsvp-verify   → valida código, devuelve nombre precargado
      │
      └── POST /api/rsvp          → guarda respuesta (single-use) + 2 correos
                                     · confirmación al participante
                                     · notificación a soluciones@scilambda.net
```

Base de datos (tablas nuevas en la misma Neon):
- `rsvp_invitees`  — código ↔ nombre precargado (fuente de verdad). Código **de un solo uso**.
- `rsvp_responses` — la respuesta + invitados sugeridos (jsonb).

Archivos añadidos:
```
learn/
├── the-ai-edge/index.html        ← página (gate + form + éxito)
├── api/rsvp-verify.js            ← valida código
├── api/rsvp.js                   ← recibe RSVP, single-use, dispara correos
├── lib/rsvp-db.js                ← lookup + transacción single-use
├── lib/rsvp-email.js             ← plantillas de correo (detalles del evento)
├── sql/002_create_rsvp.sql       ← tablas
├── scripts/gen-rsvp-codes.js     ← nombres → códigos + CSV + SQL seed
├── data/invitees.example.txt     ← plantilla de lista de invitados
└── vercel.json                   ← redirect host rsvp.* → /the-ai-edge
```

---

## Paso 1 · Migrar la base (crear tablas)

Las variables de entorno (`DATABASE_URL`, `RESEND_API_KEY`, etc.) ya existen en el
proyecto `lambda-learn` en Vercel. Solo hay que crear las tablas nuevas:

```bash
cd learn
# Opción A: correr todas las migraciones (idempotente)
DATABASE_URL="postgresql://..." node scripts/run-migration.js

# Opción B: solo esta migración
psql "$DATABASE_URL" -f sql/002_create_rsvp.sql
```
O pegar el contenido de `sql/002_create_rsvp.sql` en el **SQL Editor de Neon** y Run.

---

## Paso 2 · Generar códigos y cargar invitados

1. Copiá la plantilla y llenala con tus invitados reales:
   ```bash
   cp data/invitees.example.txt data/invitees.txt
   # editar data/invitees.txt →  Nombre | Empresa | correo(opcional)
   ```
2. Generá los códigos:
   ```bash
   node scripts/gen-rsvp-codes.js data/invitees.txt
   ```
   Produce en `scripts/out/`:
   - **`rsvp-codes.csv`** → nombre, empresa, email, **código**, link (para saber qué mandar a cada quien).
   - **`003_seed_rsvp_invitees.sql`** → INSERTs listos.
3. Cargá los invitados en Neon:
   ```bash
   psql "$DATABASE_URL" -f scripts/out/003_seed_rsvp_invitees.sql
   ```
   (o pegar en el SQL Editor de Neon).

> Los códigos son de alta entropía (formato `XXXX-XXXX`, sin caracteres ambiguos),
> imposibles de adivinar. Cada invitado recibe el suyo.

---

## Paso 3 · Subdominio `rsvp.lambda-analytics.net`

En **Vercel → proyecto `lambda-learn` → Settings → Domains**:
1. **Add Domain** → `rsvp.lambda-analytics.net`.
2. Vercel te dará un registro **CNAME** (normalmente `cname.vercel-dns.com`).
   Agregalo en el DNS de `lambda-analytics.net`:
   ```
   Tipo:   CNAME
   Nombre: rsvp
   Valor:  cname.vercel-dns.com
   ```
3. Esperar la verificación (minutos). El `redirect` en `vercel.json` hace que
   `https://rsvp.lambda-analytics.net/` lleve directo a `/the-ai-edge`.

El link para el PDF/invitación: **https://rsvp.lambda-analytics.net**

---

## Paso 4 · Variables de entorno (opcionales)

Ya funciona con las existentes. Opcionalmente, en Vercel podés fijar:

| Variable            | Default                                   | Para qué |
|---------------------|-------------------------------------------|----------|
| `RSVP_FROM`         | `LAMBDA Analytics <eventos@scilambda.net>`| Remitente de los correos del RSVP. Cualquier `@scilambda.net` sirve (dominio ya verificado en Resend). |
| `RSVP_ADMIN_EMAIL`  | `soluciones@scilambda.net`                | Destinatario interno de la notificación. |

---

## Paso 5 · Deploy y prueba

```bash
cd learn
vercel --prod        # o push a la rama conectada
```

Prueba el flujo:
1. Abrí `https://rsvp.lambda-analytics.net` → debe mostrar el header + modal.
2. Ingresá un código real del CSV → carga el form con el nombre precargado.
3. Enviá con un correo de prueba → verificá:
   - correo de confirmación al participante,
   - notificación a `soluciones@scilambda.net`,
   - el código queda **usado** (reintentar muestra "ya fue utilizado").

---

## Notas de diseño

- **Single-use**: al enviar, el código se marca `used=true` en la misma transacción
  que guarda la respuesta (imposible doble envío ni condición de carrera).
- **Nombre autoritativo**: el nombre que se guarda/envía viene del invitado precargado
  en DB, no del cliente (no manipulable).
- **Invitados sugeridos**: múltiples (nombre + correo), guardados en `jsonb`, incluidos
  en ambos correos con la nota de que el equipo evaluará su participación.
- **Anti-spam**: honeypot invisible; el nombre nunca lo envía el cliente.
- La página tiene `noindex,nofollow` (no debe aparecer en buscadores).
