# Despliegue del backend de captura de leads

> **Importante sobre la arquitectura del repo:** este repo tiene **dos proyectos Vercel separados**:
>   - **Proyecto raíz** → sirve `lambda-analytics.net` (root directory = `/`)
>   - **Proyecto learn** → sirve `learn.lambda-analytics.net` (root directory = `learn/`)
>
> Por eso **todos los archivos de backend (`api/`, `lib/`, `sql/`, `scripts/`, `package.json`) viven dentro de `learn/`**. Si los movés a la raíz, el proyecto Vercel de learn no los ve y los endpoints devuelven 404.

Arquitectura final del sitio:

```
learn.lambda-analytics.net (static HTML en Vercel)
         │
         ├── /ia-rrhh/ ─── form ── POST /api/lead ──┐
         │                                          ▼
         │                              Vercel Serverless Function
         │                                  ./api/lead.js
         │                                          │
         │                       ┌──────────────────┼──────────────────┐
         │                       ▼                  ▼                  ▼
         │              Neon Postgres        Email admin         Email lead
         │              tabla `leads`     learn@scilambda.net    (confirmación)
         │                       ▲
         │                       │ schema en /sql/001_create_leads.sql
         └─ /api/lead (mismo dominio, sin CORS)
```

Costo total cloud: **$0/mes** hasta ~50,000 leads/mes. Después: Neon $19, Vercel Pro $20.

---

## 1. Crear el database en Neon (5 min)

1. Ir a [console.neon.tech](https://console.neon.tech) y entrar con cuenta de Lambda.
2. **Create project** → nombre: `lambda-learn` → región: la más cercana (US East / São Paulo si LATAM). → Postgres version: 16 (default).
3. Al crearlo, te muestra el **Connection string**. Copiar el de tipo **"Pooled connection"** (importante: el pooled, no el direct), que se ve así:

   ```
   postgresql://USER:PASS@ep-xxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

4. (Opcional) Settings → IP Allow → dejar abierto a `0.0.0.0/0` para que Vercel pueda conectarse, o agregar el rango de IPs de Vercel si tu plan de Neon lo permite.

## 2. Aplicar el schema (2 min)

Desde tu Mac, en `learn/` (donde vive el proyecto Vercel que sirve learn.lambda-analytics.net):

```bash
cd "/Users/jasamayoa/Dropbox/Business/LAMBDA/APLICACIONES/lambda_analytics/learn"
npm install
DATABASE_URL="postgresql://...el string que copiaste..." npm run db:migrate
```

Debe imprimir:

```
✓ Conectado a Neon
▶ Ejecutando 001_create_leads.sql…
✓ 001_create_leads.sql aplicado
✓ Migración completa. Tabla leads tiene 0 registros.
```

Si falla por permisos, asegurate de que el `DATABASE_URL` sea el de la rama **main/principal**, no una rama de desarrollo de Neon.

## 3. Configurar Resend (10 min)

1. Signup en [resend.com](https://resend.com/signup) con `jorge@scilambda.net`. Gratis (no pide tarjeta).
2. **Domains → Add domain →** `scilambda.net`.
3. Resend te muestra **3 DNS records** (SPF, DKIM, DMARC). Agregalos en tu provider DNS (Cloudflare/Namecheap/etc). Esperar ~5-30 min para que la verificación pase a verde.
4. **API Keys → Create API key →** nombre: `lambda-learn-prod` → permission: **Sending access** → Create. Copiar la key (`re_...`) — solo se muestra una vez.

> Mientras los DNS propagan, podés probar enviando desde `onboarding@resend.dev` (default de Resend). Cambiá `RESEND_FROM` a `lambda Learn <onboarding@resend.dev>` temporalmente.

## 4. Configurar variables de entorno en Vercel (3 min)

Ir a [vercel.com/dashboard](https://vercel.com/dashboard) → proyecto **learn-lambda-analytics-net** → **Settings → Environment Variables**.

Agregar (todas como **Production**, **Preview** y **Development**):

| Variable | Valor |
|---|---|
| `DATABASE_URL` | El connection string pooled de Neon |
| `RESEND_API_KEY` | La key `re_...` que creaste en Resend |
| `RESEND_FROM` | `lambda Learn <learn@scilambda.net>` (o `onboarding@resend.dev` si el dominio aún no verifica) |
| `ADMIN_EMAIL` | `learn@scilambda.net` |
| `APP_URL` | `https://learn.lambda-analytics.net` |

## 5. Deploy (1 min)

```bash
cd "/Users/jasamayoa/Dropbox/Business/LAMBDA/APLICACIONES/lambda_analytics"
git add api/ lib/ sql/ scripts/ package.json .env.example DEPLOY-API.md
git add learn/ia-rrhh/index.html
git commit -m "feat: backend de captura de leads en Vercel Functions + Neon + Nodemailer

- Vercel Serverless Function /api/lead.js: valida, persiste en Neon, envía 2 emails.
- Schema Postgres con UTMs, status comercial, índices y trigger updated_at.
- Helpers /lib/db.js (pool pg) y /lib/email.js (Nodemailer con plantillas branded).
- Migration runner /scripts/run-migration.js (idempotente).
- Form en ia-rrhh: cambia de fetch a Apps Script → POST /api/lead con UTMs y referrer.
- Honeypot anti-spam invisible en el form.
- Elimina lógica de salvaguarda mailto: ahora hay backend real."

git push origin main
```

Vercel detecta el `package.json` y la carpeta `/api`, instala dependencias, y deploya las funciones automáticamente. Tarda ~1 minuto.

## 6. Validación end-to-end (3 min)

1. Esperar a que Vercel termine el deploy (verde en dashboard).
2. Abrir `https://learn.lambda-analytics.net/ia-rrhh/` en **ventana incógnito**.
3. Bajar al formulario, llenar con datos de prueba (usar email tuyo).
4. Click **Solicitar inscripción**.
5. Verificar:
   - **En el sitio**: aparece el mensaje "¡Recibimos tu solicitud!".
   - **En `learn@scilambda.net`**: llega el email con los datos del lead (subject: "Nueva inscripción · IA aplicada a RRHH…").
   - **En tu inbox**: llega el email de confirmación al lead (subject: "Recibimos tu solicitud · …").
   - **En Neon SQL Editor**: ejecutar `SELECT * FROM leads ORDER BY created_at DESC LIMIT 5;` → debe aparecer la fila.

Si algo falla, ver **Vercel → Project → Logs → Runtime Logs** para ver el error de la function.

---

## Operación diaria

### Consultar leads del día

En Neon SQL Editor:

```sql
SELECT created_at, nombre, apellido, email, empresa, cargo, status
FROM leads
WHERE created_at::date = CURRENT_DATE
ORDER BY created_at DESC;
```

### Mover un lead por el funnel

```sql
UPDATE leads SET status = 'contacted', notes = 'Llamada inicial 28 may' WHERE id = '...uuid...';
UPDATE leads SET status = 'enrolled' WHERE id = '...uuid...';
```

Estados válidos: `new`, `contacted`, `qualified`, `enrolled`, `lost`, `duplicate`.

### Métricas básicas

```sql
-- Conversión por curso
SELECT course_slug,
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE status = 'enrolled') AS enrolled,
       ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'enrolled') / COUNT(*), 1) AS conv_pct
FROM leads
GROUP BY course_slug
ORDER BY total DESC;

-- Top fuentes de adquisición
SELECT COALESCE(utm_source, origen, '(directo)') AS fuente,
       COUNT(*) AS leads,
       COUNT(*) FILTER (WHERE status = 'enrolled') AS conversiones
FROM leads
GROUP BY 1
ORDER BY leads DESC;
```

---

## Replicar a los otros cursos

Para que `fundamentos-ia` y `ia-productividad` usen el mismo endpoint:

1. Editar `learn/[curso]/index.html`, buscar el bloque `CONFIG`:
   ```js
   const SHEET_WEBHOOK_URL = 'REEMPLAZAR_CON_URL_DE_APPS_SCRIPT';
   ```
2. Reemplazar por:
   ```js
   const API_ENDPOINT = '/api/lead';
   const COURSE_SLUG = 'fundamentos-ia';  // o 'ia-productividad'
   ```
3. Copiar el resto del bloque (handler de submit, honeypot) desde `ia-rrhh`.

El mismo endpoint atiende a los 3 cursos sin cambios; el `course_slug` los distingue en la DB.

---

## Roadmap

| Cuándo | Qué |
|---|---|
| Inmediato (semana 1) | Dashboard interno simple para ver leads sin entrar a SQL: agregar `/api/leads/list.js` con auth básica y una página `/admin/`. |
| Mes 1-2 | Webhook de Slack/Discord cuando llega lead. Notificación push al equipo comercial. |
| Mes 3+ | Lead scoring con LLM: clasificar `mensaje + cargo + empresa` y rankear por probabilidad de conversión. |
| Mes 6+ | Migrar a HubSpot Free CRM cuando el equipo comercial sea >2 personas. Mantener la DB como source of truth para BI. |
