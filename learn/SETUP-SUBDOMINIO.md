# Setup del subdominio `learn.lambda-analytics.net`

Este documento describe los pasos para activar el subdominio `learn.lambda-analytics.net` apuntando al **mismo** proyecto Vercel `lambda-website-v2026`. La arquitectura usa un *host-based rewrite* configurado en `vercel.json` para servir el contenido de `/learn/*` cuando el request llega con ese subdominio.

---

## 1. Agregar el dominio en Vercel

1. Entrar al dashboard de Vercel → proyecto **lambda-website-v2026** → **Settings** → **Domains**.
2. Click en **Add Domain**.
3. Escribir `learn.lambda-analytics.net` y aceptar.
4. Vercel te dirá qué registro DNS necesita: típicamente un **CNAME** apuntando a `cname.vercel-dns.com`.

## 2. Crear el registro DNS

En el proveedor donde tengas hosteada la zona `lambda-analytics.net` (Vercel DNS, Cloudflare, Namecheap, Google Domains, etc.):

```
Tipo:   CNAME
Nombre: learn
Valor:  cname.vercel-dns.com
TTL:    3600
```

> **Si usás Cloudflare**, asegurate de poner el proxy en **DNS only** (nube gris) la primera vez para que Vercel pueda validar y emitir el certificado SSL. Después de unos minutos podés volver a activar el proxy si querés.

La propagación toma entre 5 minutos y 1 hora. Vercel emite el certificado TLS automáticamente vía Let's Encrypt una vez detecta el CNAME.

## 3. Verificar que funcione

Una vez propagado:

```bash
curl -I https://learn.lambda-analytics.net/
# debe responder 200 OK y servir /learn/index.html

curl -I https://learn.lambda-analytics.net/ia-rrhh
# debe responder 200 OK y servir /learn/ia-rrhh/index.html

curl -I https://lambda-analytics.net/learn/ia-rrhh
# debe responder 307/308 redirect a https://learn.lambda-analytics.net/ia-rrhh
```

## 4. Cómo funciona el rewrite

En `vercel.json` (raíz del proyecto):

```jsonc
{
  "rewrites": [
    {
      "source": "/:path*",
      "has": [{ "type": "host", "value": "learn.lambda-analytics.net" }],
      "destination": "/learn/:path*"
    }
  ]
}
```

- **Usuario ve**: `learn.lambda-analytics.net/ia-rrhh`
- **Archivo servido internamente**: `/learn/ia-rrhh/index.html`
- **URL en el browser no cambia** (es un rewrite, no un redirect)

Los redirects adicionales en `vercel.json` consolidan autoridad SEO en el subdominio: si alguien entra a `lambda-analytics.net/learn/ia-rrhh`, lo manda con 307 a `learn.lambda-analytics.net/ia-rrhh`.

## 5. Estructura del repo

```
lambda_analytics/
├── index.html                          ← landing principal (lambda-analytics.net)
├── vercel.json                         ← rewrites + headers (gobierna ambos hosts)
├── .vercelignore                       ← excluye lambda-learn/ del deploy
└── learn/
    ├── index.html                      ← hub (learn.lambda-analytics.net/)
    ├── ia-rrhh/
    │   ├── index.html                  ← curso completo, listo para publicar
    │   ├── img/  (elena.jpg, jorge.jpg, dimas.jpg)
    │   └── fonts/  (pirulen.otf)
    ├── ia-productividad/
    │   ├── index.html                  ← BORRADOR (template clonado)
    │   ├── img/, fonts/
    └── fundamentos-ia/
        ├── index.html                  ← BORRADOR (template clonado)
        ├── img/, fonts/
```

## 6. Pasos para terminar los cursos en borrador

Las páginas `ia-productividad/` y `fundamentos-ia/` son clones del template de `ia-rrhh` con un banner amarillo visible que dice "BORRADOR". Antes de publicar cada uno, editar:

1. **Título, descripción y OG meta** del `<head>` (ya están ajustados al nuevo curso, pero revisar el copy)
2. **Hero**: ya tiene `[BORRADOR]` en el lead — cambiar por la propuesta real del curso
3. **Stats** (sección con 8h / 4 / 3 / 70%): números del curso real
4. **Marquee** (palabras que rotan): temas del curso
5. **Programa** (4 módulos): contenido real
6. **Calendario** (4 fechas en `cal-row` + array `SESSIONS` en `<script>`): fechas y títulos reales
7. **Precio** (`price-tier`): tarifas
8. **Banner amarillo de BORRADOR**: eliminar el `<div>` cuando el contenido esté listo

## 7. Limpieza pendiente

La carpeta `lambda-learn/` en la raíz quedó como residuo del repo Git anterior. Está excluida del deploy vía `.vercelignore` pero podés eliminarla manualmente desde Finder cuando quieras (no tiene commits ni remote, no se pierde nada).

---

**Contacto técnico**: jorge@scilambda.net
