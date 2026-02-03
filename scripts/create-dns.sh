#!/bin/bash
# Crear registro DNS en Cloudflare automáticamente

SUBDOMAIN=$1
DOMAIN=${2:-eluno.org}

if [ -z "$SUBDOMAIN" ]; then
  echo "Uso: ./create-dns.sh ejemplo [eluno.org]"
  exit 1
fi

source "$(dirname "$0")/../.env"

echo "🌐 Creando DNS record para ${SUBDOMAIN}.${DOMAIN}..."

curl -X POST "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records" \
  -H "X-Auth-Email: ${CF_EMAIL}" \
  -H "X-Auth-Key: ${CF_API_KEY}" \
  -H "Content-Type: application/json" \
  --data "{
    \"type\": \"A\",
    \"name\": \"${SUBDOMAIN}\",
    \"content\": \"${UPLOAD_HOST}\",
    \"ttl\": 1,
    \"proxied\": false
  }" | python3 -m json.tool

echo ""
echo "✅ DNS creado. Verificando..."
sleep 2
dig +short ${SUBDOMAIN}.${DOMAIN} @1.1.1.1
