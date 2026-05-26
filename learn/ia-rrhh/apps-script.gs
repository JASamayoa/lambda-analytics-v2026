/**
 * lambda Analytics · Captura de leads
 * Curso: IA aplicada a RRHH y Gestión del Talento (junio 2026)
 *
 * Despliegue: script.google.com → New project → pegar este archivo →
 *   Deploy → New deployment → Type: Web app
 *   Execute as: Me (jorge@scilambda.net)
 *   Who has access: Anyone
 *   → copiar URL "/exec" y pegarla en index.html (SHEET_WEBHOOK_URL).
 *
 * Recibe el POST del formulario, opcionalmente guarda en Google Sheet,
 * y envía un email HTML a RECIPIENT con replyTo del lead.
 */

// ===== CONFIG =====
const RECIPIENT = 'learn@scilambda.net';
const SENDER_NAME = 'lambda Learn · Inscripciones';

// Si querés trazabilidad en Sheet, crea una hoja en Drive, copia su ID
// desde la URL (https://docs.google.com/spreadsheets/d/<ID>/edit) y pégalo aquí.
// Si lo dejas vacío, solo se envía el email.
const SHEET_ID = '';
const SHEET_NAME = 'Leads IA-RRHH';

const HEADERS = [
  'Timestamp','Curso','Nombre','Apellido','Email',
  'Teléfono','Empresa','Cargo','Origen','Mensaje','Fuente','UA'
];

// ===== ENTRY POINT =====
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    appendToSheet_(data);
    sendNotificationEmail_(data);

    return jsonOut_({ ok: true });
  } catch (err) {
    // Aún en error intentamos notificar para no perder el lead
    try {
      MailApp.sendEmail({
        to: RECIPIENT,
        subject: '⚠️ Error procesando lead · IA-RRHH',
        body: 'Error: ' + err.toString() + '\n\nPayload crudo:\n' + (e && e.postData ? e.postData.contents : 'N/A')
      });
    } catch (_) {}
    return jsonOut_({ ok: false, error: err.toString() });
  }
}

// Permite probar el endpoint desde el navegador (GET)
function doGet() {
  return jsonOut_({ ok: true, service: 'lambda-learn-leads', course: 'ia-rrhh' });
}

// ===== SHEET =====
function appendToSheet_(d) {
  if (!SHEET_ID) return;
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#163b59').setFontColor('#fafaf7');
    sheet.setFrozenRows(1);
  }
  sheet.appendRow([
    d.timestamp || new Date().toISOString(),
    d.curso || '',
    d.nombre || '',
    d.apellido || '',
    d.email || '',
    d.telefono || '',
    d.empresa || '',
    d.cargo || '',
    d.origen || '',
    d.mensaje || '',
    d.fuente || '',
    d.userAgent || ''
  ]);
}

// ===== EMAIL =====
function sendNotificationEmail_(d) {
  const fullName = ((d.nombre || '') + ' ' + (d.apellido || '')).trim() || '(sin nombre)';
  const subject = 'Nueva inscripción · ' + (d.curso || 'IA-RRHH') + ' · ' + fullName;
  const phoneDigits = (d.telefono || '').replace(/[^0-9]/g, '');
  const waLink = phoneDigits ? 'https://wa.me/' + phoneDigits : '';

  const html = buildHtml_(d, fullName, waLink);
  const plain = buildPlain_(d, fullName);

  const opts = {
    htmlBody: html,
    name: SENDER_NAME
  };
  // replyTo solo si tenemos email válido
  if (d.email && /\S+@\S+\.\S+/.test(d.email)) opts.replyTo = d.email;

  MailApp.sendEmail(RECIPIENT, subject, plain, opts);
}

function buildHtml_(d, fullName, waLink) {
  const row = function (k, v) {
    if (!v) return '';
    return '<tr>' +
      '<td style="padding:10px 14px;font-family:ui-monospace,Menlo,monospace;font-size:11px;color:#5a6b7d;text-transform:uppercase;letter-spacing:.1em;width:32%;vertical-align:top;border-bottom:1px solid #ece7dc;">' + k + '</td>' +
      '<td style="padding:10px 14px;color:#0a1929;font-size:14px;border-bottom:1px solid #ece7dc;">' + v + '</td>' +
      '</tr>';
  };

  const phoneCell = d.telefono
    ? d.telefono + (waLink ? ' &nbsp;·&nbsp; <a href="' + waLink + '" style="color:#163b59;border-bottom:1px solid #ffb530;text-decoration:none;">Abrir WhatsApp →</a>' : '')
    : '';
  const emailCell = d.email
    ? '<a href="mailto:' + d.email + '" style="color:#163b59;border-bottom:1px solid #ffb530;text-decoration:none;">' + d.email + '</a>'
    : '';

  return [
    '<div style="font-family:-apple-system,BlinkMacSystemFont,Inter,sans-serif;color:#0a1929;max-width:600px;margin:0 auto;">',
      '<div style="background:#163b59;padding:24px 28px;color:#fafaf7;">',
        '<div style="font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:.22em;color:#ffb530;text-transform:uppercase;font-weight:600;">Nueva inscripción</div>',
        '<div style="font-size:22px;margin-top:8px;font-weight:300;letter-spacing:-.01em;">' + fullName + '</div>',
        '<div style="font-size:13px;margin-top:4px;color:rgba(244,241,234,.75);">' + (d.curso || '') + '</div>',
      '</div>',
      '<div style="padding:8px 0 0;background:#fafaf7;border:1px solid #d8d3c8;border-top:none;">',
        '<table style="width:100%;border-collapse:collapse;">',
          row('Email', emailCell),
          row('Teléfono', phoneCell),
          row('Empresa', escapeHtml_(d.empresa)),
          row('Cargo', escapeHtml_(d.cargo)),
          row('Origen', escapeHtml_(d.origen)),
          row('Mensaje', escapeHtml_(d.mensaje).replace(/\n/g, '<br>')),
          row('Recibido', d.timestamp || new Date().toISOString()),
          row('Fuente', escapeHtml_(d.fuente)),
        '</table>',
      '</div>',
      '<div style="padding:18px 28px;background:#163b59;color:rgba(244,241,234,.6);font-family:ui-monospace,Menlo,monospace;font-size:10px;letter-spacing:.18em;text-transform:uppercase;text-align:center;">',
        'lambda Analytics · Sistema automático · Responde a este correo para contactar al lead',
      '</div>',
    '</div>'
  ].join('');
}

function buildPlain_(d, fullName) {
  const lines = [
    'NUEVA INSCRIPCIÓN · ' + (d.curso || ''),
    '',
    'Nombre:    ' + fullName,
    'Email:     ' + (d.email || ''),
    'Teléfono:  ' + (d.telefono || ''),
    'Empresa:   ' + (d.empresa || ''),
    'Cargo:     ' + (d.cargo || ''),
    'Origen:    ' + (d.origen || ''),
  ];
  if (d.mensaje) lines.push('', 'Mensaje:', d.mensaje);
  lines.push('', 'Recibido:  ' + (d.timestamp || new Date().toISOString()));
  lines.push('Fuente:    ' + (d.fuente || ''));
  return lines.join('\n');
}

function escapeHtml_(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===== TEST manual (corrérlo una vez desde el editor para probar) =====
function testRun_() {
  sendNotificationEmail_({
    timestamp: new Date().toISOString(),
    curso: 'IA aplicada a RRHH y Gestión del Talento - Junio 2026',
    nombre: 'Ada', apellido: 'Lovelace',
    email: 'ada@example.com',
    telefono: '+502 5555-1234',
    empresa: 'Analytical Engines Co.',
    cargo: 'Head of People',
    origen: 'LinkedIn',
    mensaje: 'Quiero certificar a un equipo de 6 personas. ¿Hay descuento corporativo?',
    fuente: 'web · learn.lambda-analytics.net/ia-rrhh'
  });
}
