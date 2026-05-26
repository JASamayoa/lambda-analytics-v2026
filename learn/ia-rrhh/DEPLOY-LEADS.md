# Despliegue · Captura de leads IA-RRHH

Pipeline:

```
Form (learn.lambda-analytics.net/ia-rrhh)
   │
   ├── click "Solicitar inscripción"  ── POST ──▶ Google Apps Script ──▶ Email a learn@scilambda.net
   │                                                       │
   │                                                       └──▶ Google Sheet (opcional, trazabilidad)
   │
   └── click "Atención inmediata"  ─────────────▶ WhatsApp +502 2301-0853 (mensaje prellenado)
```

Costo cloud: **$0/mes**. Apps Script: 100 emails/día gratis (cuota Workspace estándar).

---

## 1. Crear y desplegar el Apps Script

1. Entra a [script.google.com](https://script.google.com) con la cuenta `jorge@scilambda.net` (o cualquiera que tenga buzón `learn@scilambda.net` como alias autorizado).
2. **New project** → renombra el proyecto a `lambda-learn-leads`.
3. Borra el contenido por defecto del `Code.gs` y pega el contenido de `apps-script.gs` (este mismo directorio).
4. (Opcional pero recomendado) Crea una Google Sheet llamada **"Leads · IA RRHH 2026"**, copia el ID desde la URL — la parte entre `/d/` y `/edit` — y pégalo en la constante `SHEET_ID` del script. Si lo dejas vacío el script solo envía email.
5. Guarda (Ctrl+S / Cmd+S).
6. Antes del deploy, prueba que tienes permisos:
   - En el dropdown de funciones selecciona `testRun_` → **Run** → autoriza el scope de Gmail/Sheets cuando lo pida.
   - Revisa la bandeja de `learn@scilambda.net`: debe llegar el correo de prueba con datos de "Ada Lovelace".
7. **Deploy → New deployment**
   - Type: **Web app**
   - Description: `lambda-learn-leads v1`
   - Execute as: **Me** (jorge@scilambda.net)
   - Who has access: **Anyone**
   - **Deploy** → autoriza nuevamente si lo pide.
8. Copia la **Web app URL** (termina en `/exec`).

> Nota: cada vez que edites el script y quieras que los cambios surtan efecto en producción, debes hacer **Deploy → Manage deployments → ✎ Edit → Version: New version → Deploy**. No hace falta cambiar la URL.

---

## 2. Cablear la URL en el sitio

Abre `learn/ia-rrhh/index.html`, busca la constante:

```js
const SHEET_WEBHOOK_URL = 'REEMPLAZAR_CON_URL_DE_APPS_SCRIPT';
```

Reemplaza el placeholder por la URL `/exec` que copiaste. Guarda, commit y deploy a Vercel.

---

## 3. Validación end-to-end

1. Abre `learn.lambda-analytics.net/ia-rrhh` en una ventana de incógnito.
2. Llena el formulario con datos de prueba.
3. Click **Solicitar inscripción** → debe aparecer el bloque de éxito.
4. Verifica en `learn@scilambda.net` que llegó el email con todos los campos.
5. (Si configuraste Sheet) verifica que se agregó la fila.
6. Vuelve a abrir el sitio. Sin llenar nada, click **Atención inmediata** → debe abrir WhatsApp con el mensaje genérico.
7. Llena nombre + empresa, click **Atención inmediata** otra vez → debe abrir WhatsApp con el mensaje personalizado (`Hola, soy [nombre] de [empresa]...`).

---

## 4. Replicación a otros cursos

Cuando lances el segundo curso (p.ej. `fundamentos-ia`, `ia-productividad`):

- **Opción A — un solo Apps Script para todos los cursos** (recomendado): el payload ya manda `data.curso`. El email y la fila en Sheet diferencian por ese campo. Reutiliza la misma URL en todos los `index.html`. Si querés separar leads por curso, agrega una hoja distinta por curso dentro del mismo spreadsheet y enruta dentro del script según `data.curso`.
- **Opción B — un script por curso**: copia el proyecto en Apps Script, cambia `RECIPIENT` o `SHEET_NAME`, despliega URL nueva.

---

## 5. Próximos pasos (cuando quieras escalar)

| Nivel | Cuándo | Cómo |
|---|---|---|
| **+ Email automático al lead** | Cuando quieras confirmación inmediata al lead, no solo notificación interna | Añadir un `MailApp.sendEmail(d.email, ...)` en `doPost`. ~30 min. |
| **+ WhatsApp outbound real** | Cuando el volumen de leads justifique automatizar el primer touch | WhatsApp Cloud API (Meta) con plantilla aprobada. Gratis hasta 1,000 conversaciones/mes. Setup: 1-2 días. |
| **+ CRM** | Cuando el equipo comercial sea >1 persona o el ciclo de venta >7 días | HubSpot Free + Zap/Make para sincronizar Sheet → CRM. ~2h. |
| **+ Lead scoring con IA** | Cuando recibas >50 leads/mes y necesites priorizar | LLM clasifica intent + fit corporativo desde el campo "mensaje" + cargo + empresa. Ticket alto: prioridad alta. |

---

**Sources / referencias internas**

- Form HTML/JS: `learn/ia-rrhh/index.html`
- Backend: `learn/ia-rrhh/apps-script.gs`
- WhatsApp Business (Lambda): `+502 2301-0853`
- Inbox de leads: `learn@scilambda.net`
