# Setup de captura de inscripciones en Google Sheets

Sistema para que cada inscripción al formulario de los cursos quede automáticamente registrada como una fila nueva en un Google Sheet, además del WhatsApp/email de contacto.

**Tiempo total: 15-20 minutos.**

---

## Paso 1 — Crear el Google Sheet

1. Andá a [sheets.new](https://sheets.new) (te crea un sheet en blanco con tu cuenta de Google).
2. Nombrá el archivo en la barra superior: **`Lambda Learn — Inscripciones 2026`**.
3. En la pestaña "Hoja 1" abajo, hacé doble click en el nombre y cambialo a **`Inscripciones`** (sin tildes, sin espacios — importante porque el script busca exactamente este nombre).
4. En la **fila 1**, pegá estos headers de columna (uno por celda, A1 hasta K1):

| A | B | C | D | E | F | G | H | I | J | K |
|---|---|---|---|---|---|---|---|---|---|---|
| Timestamp | Curso | Nombre | Apellido | Email | Teléfono | Empresa | Cargo | Origen | Mensaje | Sent At (ISO) |

Atajo: copiá esta línea y pegala con Ctrl/Cmd+V en la celda A1, los tabs van a separar automáticamente en columnas:

```
Timestamp	Curso	Nombre	Apellido	Email	Teléfono	Empresa	Cargo	Origen	Mensaje	Sent At (ISO)
```

5. Opcional pero recomendado: marcá la fila 1 → **Format → Bold**, y desde **View → Freeze → 1 row** para que el header quede fijo al scrollear.

---

## Paso 2 — Abrir el editor de Apps Script

1. Con el sheet abierto, andá al menú: **Extensions → Apps Script**.
2. Se abre una pestaña nueva con un editor de código y un archivo `Code.gs` que tiene una función vacía `function myFunction() {}`.
3. **Borrá todo** lo que aparece ahí.
4. Pegá el siguiente código completo:

```javascript
/**
 * Lambda Learn — Captura de inscripciones
 * Recibe POST con JSON desde learn.lambda-analytics.net
 * y agrega una fila al Sheet "Inscripciones".
 */

const SHEET_NAME = 'Inscripciones';

function doPost(e) {
  try {
    let data = {};
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    }

    const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME)
               || SpreadsheetApp.getActive().getActiveSheet();

    sheet.appendRow([
      new Date(),              // A: Timestamp (server)
      data.curso || '',        // B: Curso
      data.nombre || '',       // C: Nombre
      data.apellido || '',     // D: Apellido
      data.email || '',        // E: Email
      data.telefono || '',     // F: Teléfono
      data.empresa || '',      // G: Empresa
      data.cargo || '',        // H: Cargo
      data.origen || '',       // I: Origen
      data.mensaje || '',      // J: Mensaje
      data.timestamp || ''     // K: Sent At (ISO del cliente)
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return ContentService
    .createTextOutput('Lambda Learn — Endpoint OK')
    .setMimeType(ContentService.MimeType.TEXT);
}
```

5. Click en el ícono de **💾 Save** (o Ctrl/Cmd+S). Si te pide poner nombre al proyecto, llamalo **`Lambda Learn Inscripciones`**.

---

## Paso 3 — Publicar el script como Web App

1. Arriba a la derecha, click en el botón azul **Deploy → New deployment**.
2. Click en el ícono de engranaje **⚙️** al lado de "Select type" → elegir **Web app**.
3. Completar el formulario:
   - **Description:** `v1 - captura inscripciones cursos` (cualquier texto, sirve para identificar versiones)
   - **Execute as:** **Me (tu-email@gmail.com)**
   - **Who has access:** **Anyone** (esto es importante — necesita ser público para que el sitio web pueda escribirle sin autenticación)
4. Click **Deploy**.

5. **Te va a pedir autorización** (es la primera vez):
   - Click **Authorize access**
   - Elegí tu cuenta de Google
   - **Importante:** vas a ver una pantalla de advertencia "Google hasn't verified this app". Es normal porque es tu propio script.
     - Click en **Advanced** (abajo a la izquierda)
     - Click en **Go to Lambda Learn Inscripciones (unsafe)** (es seguro, vos lo escribiste)
     - Click **Allow** para darle permisos al script de escribir en tus sheets.

6. Cuando termine el proceso, te muestra una pantalla con dos URLs:
   - **Deployment ID** (no nos sirve)
   - **Web app URL** ← **esta es la que necesitamos**

   Va a ser algo del estilo:
   ```
   https://script.google.com/macros/s/AKfycbz...HASH_LARGO.../exec
   ```

7. Click en **Copy** al lado de la Web app URL. **Guardala** — la vas a necesitar en el Paso 5.

8. Click **Done** para cerrar el modal.

---

## Paso 4 — Test rápido (opcional pero recomendado)

Antes de meter la URL en el código del sitio, verificá que el endpoint responde:

1. Pegá la Web app URL en una pestaña nueva del browser.
2. Deberías ver el texto: `Lambda Learn — Endpoint OK`
3. Si lo ves → el script está vivo y respondiendo. ✓

Si en cambio ves un error de autorización o "Sorry, unable to open the file", revisá que en el Paso 3 hayas puesto **"Who has access: Anyone"** (no "Only me").

---

## Paso 5 — Conectar el sitio con el sheet

Pasame la URL que copiaste en el Paso 3 punto 7, en un mensaje del chat. Te respondo con:
- El comando exacto para reemplazar el placeholder `REEMPLAZAR_CON_URL_DE_APPS_SCRIPT` en los 3 cursos
- El push para que entre en producción

(Yo no puedo ejecutar el script en GoogleAppsScript desde acá — el setup tiene que hacerlo el dueño de la cuenta de Google.)

---

## Paso 6 — Test end-to-end

Después del deploy:

1. Abrí `https://learn.lambda-analytics.net/ia-rrhh/?test=true` en una pestaña privada.
2. Bajá al formulario de inscripción.
3. Completá con datos ficticios (ej: nombre "Test", email "test@test.com", etc.).
4. Click **Enviar inscripción**.
5. Se te abre WhatsApp como antes (vos no envíes el mensaje, es solo test).
6. Andá a tu Google Sheet → debería haber aparecido una fila nueva con los datos.

Si la fila aparece → todo funciona. Si no, revisá:
- Que la URL en `SHEET_WEBHOOK_URL` esté correcta (sin espacios al final).
- Que el deployment del Apps Script siga activo (Deploy → Manage deployments en Apps Script).
- Que el sheet se llame exactamente `Inscripciones` (case sensitive).

---

## ¿Cómo administrar los inscriptos a partir de ahora?

**Para cada nueva inscripción** podés:

- **Filtrar por curso**: Data → Create a filter → filtrar columna B por valor del curso (ej: "IA aplicada a RRHH..."). Útil para ver inscripciones de un curso específico.
- **Exportar a CSV**: File → Download → Comma Separated Values (.csv). Para importar a un CRM (HubSpot, Pipedrive) o a Mailchimp/Brevo para email marketing.
- **Recibir notificaciones por email**: en el Sheet → Tools → Notification settings → "Any changes are made" → "Email - right away". Cada vez que llega una inscripción te llega un email.
- **Compartir con tu equipo**: botón **Share** arriba a la derecha → agregás los emails de tu equipo de RRHH/ventas. Pueden ver pero no editar para no romper datos por accidente.

---

## Cuando llegues a 50-100 inscripciones/mes y quieras escalar

El próximo paso natural es migrar a un CRM con automatizaciones. Opciones por orden:

1. **HubSpot CRM free tier** — capturás los formularios directo en HubSpot, segmentás contactos, mandás secuencias de email automatizadas (bienvenida, recordatorios de inicio de curso, etc.). El sheet sigue funcionando en paralelo como backup.
2. **Mailchimp / Brevo** — si solo querés email marketing (newsletters, anuncios de cohortes), sin pipeline de ventas.
3. **Endpoint propio + Supabase** — control total, integración con el data warehouse de Lambda. Requiere ~4h de desarrollo.

---

## Cómo actualizar el script en el futuro (agregar nuevas columnas, etc.)

1. Editás el Apps Script en el editor.
2. **Save** + **Deploy → Manage deployments → click ✏️ Edit → cambiá la versión a "New version"** → Deploy.
3. La URL del Web App **NO cambia** entre versiones — el sitio sigue funcionando sin tocar el código del cliente. Por eso es importante hacer "New version" y no "New deployment" (que sí te daría una URL nueva).

---

**Contacto técnico:** jorge@scilambda.net
