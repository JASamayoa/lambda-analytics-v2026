# Setup GitHub + Deploy automático con Vercel

Guía paso a paso para conectar el repo `lambda_analytics` a GitHub y configurar deploy automático con el proyecto Vercel existente (`lambda-website-v2026`).

Tiempo total: ~15 minutos.

---

## Paso 1. Inicializar el repo Git local

Desde Terminal:

```bash
cd "/Users/jasamayoa/Dropbox/Business/LAMBDA/APLICACIONES/lambda_analytics"
chmod +x setup-git.sh
./setup-git.sh
```

El script hace: limpia el `.git` corrupto que dejó el sandbox de Cowork, init en `main`, configura tu email, agrega todo respetando `.gitignore`, y crea el commit inicial.

Si todo sale bien vas a ver al final: **"✓ Repo Git inicializado y primer commit hecho"**.

---

## Paso 2. Crear el repo en GitHub

1. Andá a [https://github.com/new](https://github.com/new) (logueado con tu cuenta).
2. Configurá así:
   - **Repository name**: `lambda-analytics` (o el que prefieras — pero recordalo, lo vas a usar en Vercel)
   - **Owner**: tu usuario u organización de Lambda/Scilambda
   - **Visibility**: **Private** (recomendado — es código de cliente, no expongas el HTML del landing antes de tiempo)
   - **NO marques** "Add a README", "Add .gitignore" ni "Choose a license" → vamos a hacer push del repo existente
3. Click **Create repository**.

GitHub te va a mostrar instrucciones tipo "…or push an existing repository". Copiá el URL SSH o HTTPS, lo vas a usar abajo.

---

## Paso 3. Conectar el remote y hacer push

Desde la misma terminal de antes:

```bash
# Reemplazá TU-USUARIO y el nombre del repo con los reales
git remote add origin git@github.com:TU-USUARIO/lambda-analytics.git

# O si usás HTTPS (más simple si no tenés SSH configurado):
git remote add origin https://github.com/TU-USUARIO/lambda-analytics.git

# Push del primer commit
git push -u origin main
```

Si te pide credenciales y usás HTTPS, GitHub ya no acepta passwords — necesitás un **Personal Access Token** (Settings → Developer settings → Personal access tokens → Generate new token, scopes: `repo`). Si usás SSH y no lo tenés configurado, lo más rápido es generar una key con `ssh-keygen -t ed25519 -C "jorge@scilambda.net"` y pegar el contenido de `~/.ssh/id_ed25519.pub` en GitHub → Settings → SSH and GPG keys.

Si todo sale bien, refrescá la página de GitHub y vas a ver los archivos del repo.

---

## Paso 4. Conectar el repo a Vercel (sin perder el proyecto actual)

Acá hay un detalle importante: tu proyecto Vercel ya existe (`lambda-website-v2026`) con el dominio `learn.lambda-analytics.net` configurado. **NO queremos crear un proyecto nuevo** — queremos conectar Git al proyecto existente.

1. Andá al dashboard de Vercel → proyecto **lambda-website-v2026** → **Settings** → **Git**.
2. Click en **Connect Git Repository**.
3. Si es la primera vez que conectás GitHub a esta cuenta de Vercel, te va a pedir autorizar la app de Vercel en GitHub. Aceptá.
4. Cuando te muestre la lista de repos, seleccioná **`TU-USUARIO/lambda-analytics`**.
5. **Production Branch**: dejá `main`.
6. **Root Directory**: dejá vacío (la raíz del repo).
7. Click **Connect**.

Vercel automáticamente va a gatillar un deploy del último commit de `main` (que es el commit inicial con todos los archivos nuevos).

---

## Paso 5. Verificar el primer deploy automático

1. En el dashboard del proyecto, andá a **Deployments**. Vas a ver un deploy en estado "Building" y luego "Ready".
2. Cuando esté listo (~1-2 min), verificá las URLs:

```
https://lambda-analytics.net/                              → landing actualizado con sección "Academia"
https://lambda-analytics.net/#academia                     → ancla al bloque nuevo
https://learn.lambda-analytics.net/                        → hub de academia con 3 cards
https://learn.lambda-analytics.net/ia-rrhh                 → curso RRHH completo
https://learn.lambda-analytics.net/ia-productividad        → BORRADOR (banner amarillo arriba)
https://learn.lambda-analytics.net/fundamentos-ia          → BORRADOR (banner amarillo arriba)
https://lambda-analytics.net/learn/ia-rrhh                 → redirige (307) a learn.lambda-analytics.net/ia-rrhh
```

Si alguna URL devuelve 404, avisame y revisamos el rewrite del `vercel.json`.

---

## Paso 6. Flujo de trabajo a partir de ahora

Cada cambio que hagas se publica solo:

```bash
# Editar archivos en VS Code, Cursor o lo que uses
# Cuando esté listo:
cd "/Users/jasamayoa/Dropbox/Business/LAMBDA/APLICACIONES/lambda_analytics"
git add -A
git commit -m "Descripción del cambio"
git push
```

Vercel detecta el push automáticamente y deploya en ~30-60 segundos. Vas a ver el progreso en el dashboard, y opcionalmente recibís email cuando termina.

**Branches para preview:**
Si querés probar un cambio sin afectar producción, hacé una branch:

```bash
git checkout -b mejora-curso-productividad
# editás
git add -A && git commit -m "..."
git push -u origin mejora-curso-productividad
```

Vercel deploya esa branch a una URL preview tipo `lambda-website-v2026-git-mejora-curso-productividad-tu-team.vercel.app`. Cuando estés conforme, merge a `main` y se publica en producción.

---

## Notas importantes

### Dropbox + Git: precaución

El repo vive en Dropbox. Esto puede causar conflictos de sync en archivos internos de `.git/objects/`. Dos opciones para evitarlo:

- **Opción A (recomendada)**: en la app de Dropbox para Mac, click derecho en la carpeta `.git/` dentro de `lambda_analytics/` → **Smart Sync** → **Online only**. Dropbox deja de sincronizar `.git` pero el repo sigue funcionando localmente.
- **Opción B**: mover el repo fuera de Dropbox a `~/Code/lambda-analytics/` o similar. Más limpio, pero perdés el backup automático de Dropbox.

### `.vercel/` está en `.gitignore`

El archivo `.vercel/project.json` (con el `projectId`/`orgId`) NO se sube al repo — es config local de la Vercel CLI. Si en algún momento alguien más cloná el repo y quiere usar `vercel CLI`, corre `vercel link` y lo asocia al proyecto.

### Eliminar `lambda-learn/` y `setup-git.sh` después del setup

Una vez que el primer push esté hecho y el deploy funcione:

```bash
# Borrar el script de setup (ya cumplió su función)
rm setup-git.sh

# Borrar la carpeta residual lambda-learn (estaba excluida del deploy pero ensucia el repo local)
rm -rf lambda-learn

# Commit
git add -A
git commit -m "chore: limpia setup-git.sh y carpeta lambda-learn residual"
git push
```

---

**Contacto técnico:** jorge@scilambda.net
