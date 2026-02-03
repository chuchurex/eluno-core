#!/bin/bash
# Verificar que un sitio existe y funciona en Hostinger

SITE_NAME=$1

if [ -z "$SITE_NAME" ]; then
  echo "Uso: ./verify-site.sh ejemplo.eluno.org"
  exit 1
fi

source "$(dirname "$0")/../.env"

echo "🔍 Verificando sitio $SITE_NAME en Hostinger..."
echo ""

echo "📁 Estructura de directorios:"
sshpass -p "${UPLOAD_PASS}" ssh -p ${UPLOAD_PORT} -o StrictHostKeyChecking=accept-new \
  ${UPLOAD_USER}@${UPLOAD_HOST} \
  "ls -la domains/${SITE_NAME}/"

echo ""
echo "📄 Archivos en public_html:"
sshpass -p "${UPLOAD_PASS}" ssh -p ${UPLOAD_PORT} -o StrictHostKeyChecking=accept-new \
  ${UPLOAD_USER}@${UPLOAD_HOST} \
  "ls -lah domains/${SITE_NAME}/public_html/ | head -20"

echo ""
echo "🌐 Verificando acceso HTTP:"
curl -I "http://${SITE_NAME}/" 2>&1 | head -15
