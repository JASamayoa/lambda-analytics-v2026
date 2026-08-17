# lambda-analytics.net — sitio bilingüe

El sitio se **genera**. `index.html` y `en/index.html` son artefactos: no se editan a mano.

```
src/template.html      ← estructura y diseño (una sola copia)
src/_head_css.html     ← CSS principal + fuente Pirulen embebida
src/_extra_css.html    ← CSS añadido (selector de idioma, redes, a11y)
src/_academia_css.html ← CSS de la sección Academia
src/_logos.html        ← los 12 logos de clientes en base64
i18n/es.json           ← TODOS los textos en español
i18n/en.json           ← TODOS los textos en inglés
i18n/site.json         ← URLs, contacto, redes sociales, idiomas
build.js               ← generador (Node puro, sin dependencias)
```

## Flujo de trabajo

**Cambiar un texto** → editar `i18n/es.json` y/o `i18n/en.json` → `node build.js`
**Cambiar el diseño** → editar `src/template.html` o `src/_extra_css.html` → `node build.js`
**Cambiar correo, teléfono o redes** → editar `i18n/site.json` → `node build.js`

```bash
node build.js
```

Salida:

```
index.html        →  https://lambda-analytics.net/       (español, canónica)
en/index.html     →  https://lambda-analytics.net/en     (inglés)
sitemap.xml       →  con alternates hreflang por URL
robots.txt        →  incluye GPTBot / ClaudeBot / PerplexityBot
site.webmanifest
```

`build.js` avisa en consola si una clave del template no existe en el JSON
(`⚠ clave sin valor en en.json: ...`), así que un texto olvidado en la traducción
no pasa desapercibido.

## Agregar un tercer idioma

1. Copiar `i18n/es.json` → `i18n/pt.json` y traducir.
2. Añadir a `i18n/site.json`:
   ```json
   { "code": "pt", "path": "/pt", "hreflang": "pt-BR" }
   ```
3. `node build.js`. El selector, los hreflang y el sitemap se actualizan solos.

## Detección de idioma por IP

`middleware.js` (Vercel Edge Middleware, sin dependencias npm) decide en este orden:

1. `?lang=es|en` en la URL → manda, y guarda cookie.
2. **Rastreador** (Googlebot, Bingbot, GPTBot, previews de WhatsApp/LinkedIn…) → nunca se redirige.
   Es la regla crítica: Google rastrea desde IPs de EE.UU. y sin esta excepción
   indexaría todo el sitio como inglés.
3. Cookie `lang` de una visita anterior → manda.
4. País de la IP (`x-vercel-ip-country`): si no es hispanohablante → `/en`.
5. Desempate: si el navegador declara `Accept-Language: es`, se queda en español
   (un guatemalteco de viaje en Miami sigue viendo el sitio en español).

Redirect **302**, nunca 301: la decisión depende del visitante, no de la URL.

### Probarlo sin esperar a un visitante extranjero

```bash
# fuerza inglés
curl -sI https://lambda-analytics.net/?lang=en | grep -i location

# simula una IP de EE.UU. (solo funciona en preview con la cabecera inyectada)
curl -sI https://lambda-analytics.net/ \
  -H 'x-vercel-ip-country: US' \
  -H 'accept-language: en-US,en;q=0.9' \
  -H 'user-agent: Mozilla/5.0' | grep -i location

# comprueba que Googlebot NO se redirige
curl -sI https://lambda-analytics.net/ \
  -H 'x-vercel-ip-country: US' \
  -H 'user-agent: Googlebot/2.1' | head -1
```

## Después de desplegar

- [ ] Google Search Console → añadir propiedad y enviar `https://lambda-analytics.net/sitemap.xml`
- [ ] Search Console → Segmentación internacional: verificar que no reporta errores de hreflang
- [ ] [Rich Results Test](https://search.google.com/test/rich-results) sobre `/` y `/en`
- [ ] Compartir el enlace en LinkedIn para forzar el refresco de la og:image
- [ ] Bing Webmaster Tools → importar desde Search Console (5 minutos, tráfico extra gratis)
