#!/usr/bin/env bash
# ============================================================
# Setup inicial del repo Git para lambda_analytics
# Correr UNA SOLA VEZ desde la raíz del proyecto:
#   cd "/Users/jasamayoa/Dropbox/Business/LAMBDA/APLICACIONES/lambda_analytics"
#   chmod +x setup-git.sh
#   ./setup-git.sh
# ============================================================

set -e

echo "════════════════════════════════════════════════════════════"
echo "  Setup de Git para lambda_analytics"
echo "════════════════════════════════════════════════════════════"
echo ""

# Paso 1: limpieza del repo que dejó el sandbox de Cowork (puede tener locks)
if [ -d .git ]; then
  echo "→ Limpiando repo .git anterior (creado por el sandbox)..."
  rm -rf .git
fi

# Paso 2: limpiar archivos FUSE residuales del sandbox
echo "→ Limpiando archivos temporales del sandbox..."
find . -name ".fuse_hidden*" -delete 2>/dev/null || true

# Paso 3: init limpio
echo "→ Inicializando repo en main..."
git init -b main

# Paso 4: configurar identidad solo para este repo (no toca tu config global)
git config user.email "jorge@scilambda.net"
git config user.name "Jorge Samayoa"

# Paso 5: stage everything respetando .gitignore
echo "→ Staging archivos (respetando .gitignore)..."
git add -A

# Paso 6: mostrar resumen
echo ""
echo "════════════════════════════════════════════════════════════"
echo "  Archivos que se van a comitear:"
echo "════════════════════════════════════════════════════════════"
git status --short
echo ""
git diff --cached --stat | tail -15
echo ""

# Paso 7: primer commit
echo "→ Creando commit inicial..."
git commit -m "Initial commit: landing + academia learn.lambda-analytics.net con 3 cursos

- Landing principal con sección Academia integrada
- Hub de cursos en /learn/index.html
- Curso ia-rrhh completo (production-ready)
- Cursos ia-productividad y fundamentos-ia (template clonado, marcado como BORRADOR)
- vercel.json con host-based rewrite para learn.lambda-analytics.net → /learn/*
- Redirects 307 desde /learn/* del dominio raíz al subdominio canónico"

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  ✓ Repo Git inicializado y primer commit hecho"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "PRÓXIMO PASO:"
echo "  1. Crear el repo en GitHub (ver instrucciones en SETUP-GITHUB.md)"
echo "  2. Conectar el remote y hacer push:"
echo "       git remote add origin git@github.com:TU-USUARIO/lambda-analytics.git"
echo "       git push -u origin main"
echo "  3. Conectar el repo a Vercel desde el dashboard"
echo ""
