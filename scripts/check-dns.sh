#!/bin/bash
# Verificar DNS para un dominio

DOMAIN=$1

if [ -z "$DOMAIN" ]; then
  echo "Uso: ./check-dns.sh ejemplo.eluno.org"
  exit 1
fi

echo "🔍 Verificando DNS para $DOMAIN"
echo ""

echo "📡 Google DNS (8.8.8.8):"
dig +short $DOMAIN @8.8.8.8

echo ""
echo "📡 Cloudflare DNS (1.1.1.1):"
dig +short $DOMAIN @1.1.1.1

echo ""
echo "🌐 DNS Local:"
dig +short $DOMAIN

echo ""
echo "✅ DNS Records en Cloudflare:"
source "$(dirname "$0")/../.env"
curl -s "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records?name=${DOMAIN}" \
  -H "X-Auth-Email: ${CF_EMAIL}" \
  -H "X-Auth-Key: ${CF_API_KEY}" | \
  python3 -c "import sys,json; data=json.load(sys.stdin); [print(f\"{r['type']} {r['name']} -> {r['content']} (proxied: {r['proxied']})\") for r in data['result']]"
