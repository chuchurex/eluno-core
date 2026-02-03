#!/bin/bash

# ==============================================================================
# QA Verification Routine - Eluno.org Ecosystem
# ==============================================================================
# Este script verifica el estado de salud de los sitios web y la disponibilidad
# de los recursos estáticos críticos (MP3, PDF) mediante solicitudes HTTP (curl).
#
# Además, realiza un "crawl" básico de las páginas principales para verificar
# que los enlaces a recursos multimedia esten funcionado realmente.
#
# Uso: ./packages/core/scripts/qa-verify.sh
# ==============================================================================

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

check_url() {
    local url=$1
    local description=$2
    local expected_code=${3:-200}
    
    echo -n "Checking $description... "
    # Usamos -L para seguir redirecciones si es necesario
    code=$(curl -s -o /dev/null -w "%{http_code}" -L "$url")
    
    if [ "$code" -eq "$expected_code" ]; then
        echo -e "${GREEN}OK ($code)${NC} - $url"
        return 0
    else
        echo -e "${RED}FAIL ($code)${NC} - $url"
        return 1
    fi
}

check_page_assets() {
    local page_url=$1
    echo -e "\n🔍 Scanning assets on ${YELLOW}$page_url${NC}"
    
    # Extraer URLs de mp3 y pdf
    # Buscamos href="..." que termine en .mp3 o .pdf
    assets=$(curl -s "$page_url" | grep -o 'href="[^"]*\.\(mp3\|pdf\)"' | sed 's/href="//;s/"//' | sort | uniq)
    
    if [ -z "$assets" ]; then
        echo -e "${YELLOW}⚠️  No .mp3 or .pdf assets found on this page.${NC}"
        # No es necesariamente un error, pero es una advertencia
        return 0
    fi

    local error_count=0
    for asset in $assets; do
        asset_name=$(basename "$asset")
        # Verificar si es una URL relativa o absoluta
        if [[ "$asset" != http* ]]; then
             # Si es relativa (no empieza con http), asumimos que está rota o necesita base
             # Pero en nuestro caso esperamos URLs absolutas a static.eluno.org
             echo -e "${YELLOW}⚠️  Relative link found (unexpected): $asset${NC}"
        fi
        
        check_url "$asset" "  Asset: $asset_name"
        if [ $? -ne 0 ]; then
            ((error_count++))
        fi
    done
    
    if [ $error_count -gt 0 ]; then
        echo -e "${RED}❌ Found $error_count broken links in $page_url${NC}"
    else 
        echo -e "${GREEN}✅ All assets on page are accessible${NC}"
    fi
}

echo "========================================================"
echo "🛡️  INICIANDO VERIFICACIÓN QA - ELUNO.ORG"
echo "========================================================"
echo ""

# 1. Verificar Dominios Principales
echo "--- 1. Dominios Principales ---"
check_url "https://eluno.org" "El Uno (Portal)"
check_url "https://todo.eluno.org" "Todo (La Ley del Uno)"
check_url "https://sanacion.eluno.org" "Sanación"
check_url "https://jesus.eluno.org" "Jesús"
echo ""

# 2. Verificar Subdominio Estático
echo "--- 2. Servidor de Archivos Estáticos ---"
check_url "https://static.eluno.org" "Static Server Root"
echo ""

# 3. Cros-Check (Frontend -> Assets)
echo "--- 3. Cross-Check de Enlaces en Frontend ---"

# TODO
check_page_assets "https://todo.eluno.org/es/ch1/"
check_page_assets "https://todo.eluno.org/es/" 

# JESUS
check_page_assets "https://jesus.eluno.org/es/ch1/"

# SANACION
check_page_assets "https://sanacion.eluno.org/en/ch1/"

echo ""
echo "========================================================"
echo "🏁 Verificación completada"
echo "========================================================"
