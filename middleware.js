/* ============================================================================
   Lambda Analytics — Vercel Edge Middleware
   ----------------------------------------------------------------------------
   Envía a /en a los visitantes que llegan a la raíz desde un país no
   hispanohablante, SIN romper el SEO. Reglas de diseño:

     1. Nunca redirige a un rastreador. Googlebot rastrea casi todo desde IPs
        de EE.UU.: si lo redirigiéramos, indexaría el sitio entero como inglés
        y la versión en español perdería su posicionamiento.
     2. Nunca redirige si el visitante ya eligió idioma (cookie `lang`),
        ni si llega con ?lang=es|en explícito.
     3. Usa 302 (temporal), no 301: la decisión depende del visitante, no de
        la URL; un 301 quedaría cacheado en el navegador de forma permanente.
     4. El navegador gana sobre la IP: si el Accept-Language declara español,
        el visitante se queda en español aunque su IP sea de EE.UU.
     5. Emite Vary para que ninguna CDN sirva la versión equivocada.

   Sin dependencias npm: `next()` en @vercel/edge no es más que la cabecera
   `x-middleware-next: 1`, y `geolocation()` lee `x-vercel-ip-country`.
   ========================================================================== */

export const config = {
  // Solo las dos portadas. Assets, sitemap y robots pasan directo.
  matcher: ['/', '/en', '/en/'],
};

// Países donde el español es lengua oficial o mayoritaria → se quedan en /.
const SPANISH_SPEAKING = new Set([
  'GT', 'SV', 'HN', 'NI', 'CR', 'PA', 'MX', 'CU', 'DO', 'PR',
  'CO', 'VE', 'EC', 'PE', 'BO', 'CL', 'AR', 'UY', 'PY', 'ES', 'GQ',
]);

// Rastreadores de buscadores, de IA y generadores de preview de enlaces.
const BOT_PATTERN =
  /(bot|crawler|spider|crawling|slurp|facebookexternalhit|embedly|quora link preview|showyoubot|outbrain|pinterest|vkshare|w3c_validator|whatsapp|telegram|discord|linkedinbot|twitterbot|applebot|petalbot|yandex|baidu|duckduck|semrush|ahrefs|lighthouse|gtmetrix|headlesschrome)/i;

const ES_PATH = '/';
const EN_PATH = '/en';

export default function middleware(request) {
  const url = new URL(request.url);
  const isEnglishPage = url.pathname.startsWith('/en');

  // --- 1. Override explícito: ?lang=en | ?lang=es --------------------------
  const forced = url.searchParams.get('lang');
  if (forced === 'es' || forced === 'en') {
    const want = forced === 'en' ? EN_PATH : ES_PATH;
    const alreadyThere = forced === 'en' ? isEnglishPage : !isEnglishPage;
    return alreadyThere ? pass(forced) : go(want, url, forced);
  }

  // --- 2. Rastreadores: nunca redirigir ------------------------------------
  const ua = request.headers.get('user-agent') || '';
  if (BOT_PATTERN.test(ua)) return pass();

  // --- 3. Ya estamos en /en: no hay nada que decidir -----------------------
  if (isEnglishPage) return pass();

  // --- 4. Preferencia guardada previamente ---------------------------------
  const cookie = request.headers.get('cookie') || '';
  const saved = /(?:^|;\s*)lang=(es|en)/.exec(cookie);
  if (saved) return saved[1] === 'en' ? go(EN_PATH, url) : pass();

  // --- 5. Geolocalización por IP -------------------------------------------
  const country = (request.headers.get('x-vercel-ip-country') || '').toUpperCase();

  // Sin dato de país → español (comportamiento actual, sin sorpresas).
  if (!country || SPANISH_SPEAKING.has(country)) return pass();

  // --- 6. Desempate: el idioma del navegador manda sobre la IP -------------
  const accept = (request.headers.get('accept-language') || '').toLowerCase();
  if (/(^|[,\s])es\b/.test(accept)) return pass();

  return go(EN_PATH, url);
}

/* ---------- helpers -------------------------------------------------------- */

const VARY = 'Cookie, Accept-Language';

/** Deja pasar la petición sin redirigir. */
function pass(setLang) {
  const headers = { 'x-middleware-next': '1', Vary: VARY };
  if (setLang) headers['Set-Cookie'] = cookieFor(setLang);
  return new Response(null, { headers });
}

/** Redirige 302 conservando la querystring (menos ?lang, que ya se consumió). */
function go(pathname, base, setLang) {
  const target = new URL(pathname, base);
  const params = new URLSearchParams(base.search);
  params.delete('lang');
  target.search = params.toString();

  const headers = {
    Location: target.toString(),
    Vary: VARY,
    'Cache-Control': 'no-store',
  };
  if (setLang) headers['Set-Cookie'] = cookieFor(setLang);

  return new Response(null, { status: 302, headers });
}

const cookieFor = (lang) =>
  `lang=${lang}; Path=/; Max-Age=31536000; SameSite=Lax`;
