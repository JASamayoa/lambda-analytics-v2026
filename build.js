#!/usr/bin/env node
/* ============================================================================
   Lambda Analytics — generador estático bilingüe
   ----------------------------------------------------------------------------
   Fuente de la verdad:
     src/template.html   → estructura y diseño (una sola vez)
     i18n/es.json        → todos los textos en español
     i18n/en.json        → todos los textos en inglés
     i18n/site.json      → URLs, contacto, redes sociales

   Salida:
     index.html          → español   (https://lambda-analytics.net/)
     en/index.html       → inglés    (https://lambda-analytics.net/en/)
     sitemap.xml
     robots.txt
     site.webmanifest

   Uso:  node build.js
   Para agregar un idioma: crear i18n/<code>.json y añadirlo a site.languages.
   ========================================================================== */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const readJSON = (p) => JSON.parse(read(p));

const site = readJSON('i18n/site.json');
const template = read('src/template.html');
const headCssRaw = read('src/_head_css.html');
const extraCss = read('src/_extra_css.html');
const academiaCss = read('src/_academia_css.html');
const logosHtml = read('src/_logos.html');

// Inyecta el CSS adicional justo antes de cerrar el <style> principal
const headCss = headCssRaw.replace(/<\/style>\s*$/, extraCss + '\n</style>');

/* ---------- utilidades ---------------------------------------------------- */

// Escapa texto que va dentro de un atributo HTML (title, alt, content...)
const attr = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Quita etiquetas HTML (para meta descriptions y JSON-LD)
const strip = (s) => String(s).replace(/<[^>]+>/g, '');

// Resuelve "a.b.c" dentro de un objeto
const get = (obj, keyPath) =>
  keyPath.split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);

const ICONS = {
  linkedin:
    '<path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.42v1.56h.05a3.75 3.75 0 0 1 3.37-1.85c3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zm1.78 13.02H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"/>',
  facebook:
    '<path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z"/>',
  instagram:
    '<path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41-.56-.22-.96-.48-1.38-.9-.42-.42-.68-.82-.9-1.38-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41 1.27-.06 1.65-.07 4.85-.07M12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63a5.9 5.9 0 0 0-2.13 1.38A5.9 5.9 0 0 0 .63 4.14c-.3.76-.5 1.64-.56 2.91C.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.31.79.72 1.46 1.38 2.13a5.9 5.9 0 0 0 2.13 1.38c.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56a5.9 5.9 0 0 0 2.13-1.38 5.9 5.9 0 0 0 1.38-2.13c.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91a5.9 5.9 0 0 0-1.38-2.13A5.9 5.9 0 0 0 19.86.63c-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0zm0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32zm0 10.16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm7.85-10.4a1.44 1.44 0 1 1-2.88 0 1.44 1.44 0 0 1 2.88 0z"/>',
};

const SOCIAL_LABELS = {
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  instagram: 'Instagram',
};

/* ---------- renderers de bloques repetidos -------------------------------- */

const renderCredibility = (t) =>
  t.credibility
    .map((item) => `    <div class="cred-item">${item}</div>`)
    .join('\n');

const renderCapacidades = (t) =>
  t.capacidades.items
    .map(
      (c) => `      <article class="cap">
        <p class="cap-num" aria-hidden="true">${c.num}</p>
        <h3>${c.title}</h3>
        <p>${c.text}</p>
        <div class="cap-tags">
${c.tags.map((tag) => `          <span class="cap-tag">${tag}</span>`).join('\n')}
        </div>
      </article>`
    )
    .join('\n\n');

const renderPillars = (t) =>
  t.metodologia.pillars
    .map(
      (p) => `        <div class="pillar">
          <p class="pillar-num" aria-hidden="true">${p.num}</p>
          <div>
            <h3>${p.title}</h3>
            <p>${p.text}</p>
          </div>
        </div>`
    )
    .join('\n');

const renderAcademiaCards = (t) =>
  t.academia.cards
    .map(
      (c) => `      <article class="academia-card">
        <span class="ac-tag">${c.tag}</span>
        <h3>${c.title}</h3>
        <p>${c.text}</p>
        <p class="ac-meta">${c.meta}</p>
        <a href="${c.href}" class="ac-link">${t.academia.linkLabel}</a>
      </article>`
    )
    .join('\n\n');

const renderFooterList = (items) =>
  items
    .map((i) => {
      const ext = i.external ? ' target="_blank" rel="noopener"' : '';
      return `          <li><a href="${i.href}"${ext}>${i.label}</a></li>`;
    })
    .join('\n');

const renderSocial = () =>
  Object.entries(site.social)
    .map(
      ([key, url]) =>
        `          <a href="${url}" target="_blank" rel="noopener me" aria-label="${SOCIAL_LABELS[key]}" title="${SOCIAL_LABELS[key]}">` +
        `<svg viewBox="0 0 24 24" role="img" aria-hidden="true" focusable="false">${ICONS[key]}</svg></a>`
    )
    .join('\n');

const renderLangSwitch = (t, lang) =>
  site.languages
    .map((l, idx) => {
      const isCurrent = l.code === lang;
      const label = t.langSwitch[l.code + 'Label'];
      const title = t.langSwitch[l.code + 'Title'];
      const sep = idx > 0 ? '      <span class="lang-sep" aria-hidden="true"></span>\n' : '';
      return (
        sep +
        `      <a href="${l.path}" hreflang="${l.hreflang}" lang="${l.hreflang}" ` +
        `data-set-lang="${l.code}" title="${attr(title)}"` +
        (isCurrent ? ' aria-current="true"' : '') +
        `>${label}</a>`
      );
    })
    .join('\n');

const renderHreflang = () => {
  const rows = site.languages.map(
    (l) =>
      `<link rel="alternate" hreflang="${l.hreflang}" href="${site.origin}${l.path}" />`
  );
  rows.push(
    `<link rel="alternate" hreflang="x-default" href="${site.origin}${site.languages[0].path}" />`
  );
  return rows.join('\n');
};

/* ---------- JSON-LD ------------------------------------------------------- */

const renderJsonLd = (t, lang) => {
  const canonical = site.origin + (lang === site.languages[0].code ? '/' : `/${lang}/`);
  const sameAs = Object.values(site.social);

  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${site.origin}/#organization`,
        name: site.brand,
        legalName: site.legalName,
        url: site.origin,
        logo: {
          '@type': 'ImageObject',
          '@id': `${site.origin}/#logo`,
          url: `${site.origin}/logo.png`,
          contentUrl: `${site.origin}/logo.png`,
          caption: site.brand,
        },
        image: { '@id': `${site.origin}/#logo` },
        description: t.meta.orgDescription,
        foundingDate: site.foundingDate,
        email: site.email,
        telephone: site.phone,
        address: {
          '@type': 'PostalAddress',
          addressLocality: site.address.locality,
          addressRegion: site.address.region,
          addressCountry: site.address.country,
        },
        areaServed: site.areaServed.map((n) => ({ '@type': 'Country', name: n })),
        knowsLanguage: ['es', 'en'],
        sameAs,
      },
      {
        '@type': 'ProfessionalService',
        '@id': `${site.origin}/#service`,
        name: site.brand,
        parentOrganization: { '@id': `${site.origin}/#organization` },
        url: canonical,
        description: t.meta.orgDescription,
        priceRange: '$$$',
        address: {
          '@type': 'PostalAddress',
          addressLocality: site.address.locality,
          addressRegion: site.address.region,
          addressCountry: site.address.country,
        },
        areaServed: site.areaServed.map((n) => ({ '@type': 'Country', name: n })),
        sameAs,
        hasOfferCatalog: {
          '@type': 'OfferCatalog',
          name: t.capacidades.eyebrow,
          itemListElement: t.capacidades.items.map((c, i) => ({
            '@type': 'Offer',
            position: i + 1,
            itemOffered: {
              '@type': 'Service',
              name: c.title,
              description: c.text,
              serviceType: c.tags.join(', '),
              provider: { '@id': `${site.origin}/#organization` },
            },
          })),
        },
      },
      {
        '@type': 'WebSite',
        '@id': `${site.origin}/#website`,
        url: site.origin,
        name: site.brand,
        description: strip(t.meta.description),
        publisher: { '@id': `${site.origin}/#organization` },
        inLanguage: site.languages.map((l) => l.hreflang),
      },
      {
        '@type': 'WebPage',
        '@id': `${canonical}#webpage`,
        url: canonical,
        name: t.meta.webPageName,
        description: strip(t.meta.description),
        isPartOf: { '@id': `${site.origin}/#website` },
        about: { '@id': `${site.origin}/#organization` },
        inLanguage: t.htmlLang,
        primaryImageOfPage: { '@id': `${site.origin}/#logo` },
      },
    ],
  };

  return JSON.stringify(graph, null, 2);
};

/* ---------- render de una página ------------------------------------------ */

function renderPage(lang) {
  const t = readJSON(`i18n/${lang}.json`);
  const langDef = site.languages.find((l) => l.code === lang);
  const canonical = site.origin + langDef.path;

  const blocks = {
    '{{@headCss}}': headCss,
    '{{@academiaCss}}': academiaCss,
    '{{@hreflang}}': renderHreflang(),
    '{{@jsonld}}': renderJsonLd(t, lang),
    '{{@credibility}}': renderCredibility(t),
    '{{@capacidades}}': renderCapacidades(t),
    '{{@logos}}': logosHtml,
    '{{@pillars}}': renderPillars(t),
    '{{@academiaCards}}': renderAcademiaCards(t),
    '{{@footerCol1}}': renderFooterList(t.footer.col1),
    '{{@footerCol2}}': renderFooterList(t.footer.col2),
    '{{@social}}': renderSocial(),
    '{{@langSwitch}}': renderLangSwitch(t, lang),
  };

  let html = template;
  for (const [k, v] of Object.entries(blocks)) html = html.split(k).join(v);

  // Contexto plano para los {{...}} escalares
  const ctx = {
    ...t,
    site,
    canonical,
    home: langDef.path,
    'cta.mailSubjectEnc': encodeURIComponent(t.cta.mailSubject),
  };

  html = html.replace(/\{\{([a-zA-Z0-9_.]+)\}\}/g, (m, key) => {
    const val = ctx[key] !== undefined ? ctx[key] : get(ctx, key);
    if (val === undefined) {
      console.warn(`  ⚠  clave sin valor en ${lang}.json: ${key}`);
      return '';
    }
    return String(val);
  });

  // Los meta/atributos no deben llevar HTML: se limpian tras la sustitución
  html = html.replace(
    /(<meta[^>]+content=")([^"]*)(")/g,
    (m, a, content, c) => a + attr(strip(content)) + c
  );

  return html;
}

/* ---------- archivos auxiliares ------------------------------------------- */

function renderSitemap() {
  const today = new Date().toISOString().slice(0, 10);
  const urls = site.languages
    .map((l) => {
      const alts = site.languages
        .map(
          (a) =>
            `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${site.origin}${a.path}"/>`
        )
        .concat(
          `    <xhtml:link rel="alternate" hreflang="x-default" href="${site.origin}${site.languages[0].path}"/>`
        )
        .join('\n');
      return `  <url>
    <loc>${site.origin}${l.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
${alts}
  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`;
}

const renderRobots = () => `# https://lambda-analytics.net/robots.txt
User-agent: *
Allow: /

# Rastreadores de IA — permitidos a propósito: queremos aparecer
# como fuente cuando alguien pregunta por analítica avanzada en la región.
User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

Sitemap: ${site.origin}/sitemap.xml
`;

const renderManifest = () =>
  JSON.stringify(
    {
      name: site.brand,
      short_name: 'Lambda',
      description: readJSON('i18n/es.json').meta.description,
      start_url: '/',
      display: 'browser',
      background_color: '#faf6ee',
      theme_color: '#081826',
      icons: [
        { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
        { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      ],
    },
    null,
    2
  ) + '\n';

/* ---------- ejecución ------------------------------------------------------ */

function write(rel, content) {
  const full = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  const kb = (Buffer.byteLength(content) / 1024).toFixed(1);
  console.log(`  ✓ ${rel.padEnd(22)} ${kb.padStart(7)} KB`);
}

console.log('\nLambda Analytics — build\n');

for (const l of site.languages) {
  const out = l.code === site.languages[0].code ? 'index.html' : `${l.code}/index.html`;
  write(out, renderPage(l.code));
}

write('sitemap.xml', renderSitemap());
write('robots.txt', renderRobots());
write('site.webmanifest', renderManifest());

console.log('\nListo.\n');
