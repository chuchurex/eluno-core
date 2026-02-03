#!/usr/bin/env node

/**
 * Audiobook TTS Preparation Script
 *
 * Generates clean Markdown files optimized for audio recording/TTS.
 * - Converts all numbers to Spanish text for easier narration
 * - Preserves original structure for reference
 *
 * Usage:
 *   node scripts/build-audiobook-tts.js
 *
 * Input/Output:
 *   audiobook/content/es/*.md (in-place)
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = process.cwd();
const CONTENT_DIR = path.join(PROJECT_ROOT, 'audiobook', 'content', 'es');

// Number to Spanish text conversion
const UNITS = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
const TENS = ['', 'diez', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const TEENS = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
const TWENTIES = ['veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
const HUNDREDS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

function numberToSpanish(num) {
  if (num === 0) return 'cero';
  if (num < 0) return 'menos ' + numberToSpanish(-num);

  if (num === 100) return 'cien';
  if (num === 1000) return 'mil';
  if (num === 1000000) return 'un millón';

  let result = '';

  // Billions (mil millones)
  if (num >= 1000000000) {
    const billions = Math.floor(num / 1000000000);
    if (billions === 1) {
      result += 'mil millones ';
    } else {
      result += numberToSpanish(billions) + ' mil millones ';
    }
    num %= 1000000000;
  }

  // Millions
  if (num >= 1000000) {
    const millions = Math.floor(num / 1000000);
    if (millions === 1) {
      result += 'un millón ';
    } else {
      result += numberToSpanish(millions) + ' millones ';
    }
    num %= 1000000;
    // Add "de" before nouns when it's a round million number
    if (num === 0) {
      result = result.trim() + ' de ';
    }
  }

  // Thousands
  if (num >= 1000) {
    const thousands = Math.floor(num / 1000);
    if (thousands === 1) {
      result += 'mil ';
    } else {
      result += numberToSpanish(thousands) + ' mil ';
    }
    num %= 1000;
  }

  // Hundreds
  if (num >= 100) {
    const hundreds = Math.floor(num / 100);
    if (hundreds === 1 && num === 100) {
      result += 'cien';
      return result.trim();
    }
    result += HUNDREDS[hundreds] + ' ';
    num %= 100;
  }

  // Tens and units
  if (num >= 30) {
    const tens = Math.floor(num / 10);
    const units = num % 10;
    result += TENS[tens];
    if (units > 0) {
      result += ' y ' + UNITS[units];
    }
  } else if (num >= 20) {
    result += TWENTIES[num - 20];
  } else if (num >= 10) {
    result += TEENS[num - 10];
  } else if (num > 0) {
    result += UNITS[num];
  }

  return result.trim();
}

function convertNumbersToText(text) {
  // Handle numbers with dots or commas as thousands separators
  // Must process larger numbers first (millions, then thousands)

  // Billions: 1,000,000,000 or 1.000.000.000 format
  text = text.replace(/\b(\d{1,3})[.,](\d{3})[.,](\d{3})[.,](\d{3})\b/g, (match, p1, p2, p3, p4) => {
    const num = parseInt(p1 + p2 + p3 + p4);
    return numberToSpanish(num);
  });

  // Millions: 1.000.000 or 1,000,000 format
  text = text.replace(/\b(\d{1,3})[.,](\d{3})[.,](\d{3})\b/g, (match, p1, p2, p3) => {
    const num = parseInt(p1 + p2 + p3);
    return numberToSpanish(num);
  });

  // Thousands: 25.000 or 25,000 format (ensure it's exactly 3 digits after separator)
  text = text.replace(/\b(\d{1,3})[.,](\d{3})\b/g, (match, p1, p2) => {
    const num = parseInt(p1 + p2);
    return numberToSpanish(num);
  });

  // Handle percentages: 51%, 95%, etc.
  text = text.replace(/\b(\d+)\s*%/g, (match, num) => {
    return numberToSpanish(parseInt(num)) + ' por ciento';
  });

  // Handle ordinals (1a, 2a, 3a, etc.) - use word boundaries to avoid partial matches
  const ordinalsFem = {
    '1a': 'primera', '2a': 'segunda', '3a': 'tercera', '4a': 'cuarta', '5a': 'quinta',
    '6a': 'sexta', '7a': 'séptima', '8a': 'octava', '9a': 'novena', '10a': 'décima'
  };
  const ordinalsMasc = {
    '1o': 'primero', '2o': 'segundo', '3o': 'tercero', '4o': 'cuarto', '5o': 'quinto',
    '6o': 'sexto', '7o': 'séptimo', '8o': 'octavo', '9o': 'noveno', '10o': 'décimo'
  };

  for (const [num, word] of Object.entries(ordinalsFem)) {
    text = text.replace(new RegExp('\\b' + num + '\\b', 'g'), word);
  }
  for (const [num, word] of Object.entries(ordinalsMasc)) {
    text = text.replace(new RegExp('\\b' + num + '\\b', 'g'), word);
  }

  // Handle Roman numerals commonly used
  const romanNumerals = {
    'III': 'tres',
    'II': 'dos',
    'IV': 'cuatro',
    'VI': 'seis',
    'VII': 'siete',
    'VIII': 'ocho'
  };

  for (const [roman, word] of Object.entries(romanNumerals)) {
    // Only replace when surrounded by word boundaries or in specific contexts
    text = text.replace(new RegExp('\\b' + roman + '\\b', 'g'), word);
  }

  // Handle remaining standalone numbers (only pure digits, not decimals)
  text = text.replace(/\b(\d+)\b/g, (match) => {
    const num = parseInt(match);
    if (num <= 1000000000) {
      return numberToSpanish(num);
    }
    return match;
  });

  return text;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function processFile(inputPath, outputPath) {
  const content = fs.readFileSync(inputPath, 'utf8');
  const converted = convertNumbersToText(content);
  fs.writeFileSync(outputPath, converted);
  return converted.length;
}

async function main() {
  console.log('\n🎙️  Preparando archivos del audiolibro para TTS/grabación...\n');

  const files = fs.readdirSync(CONTENT_DIR)
    .filter(f => f.endsWith('.md') && !f.includes('-v2'))
    .sort();

  console.log(`📂 Directorio: ${CONTENT_DIR}`);
  console.log(`📄 Archivos a procesar: ${files.length}\n`);

  let totalChars = 0;

  for (const file of files) {
    const filePath = path.join(CONTENT_DIR, file);

    const charCount = processFile(filePath, filePath);
    totalChars += charCount;

    console.log(`   ✅ ${file} (${charCount.toLocaleString()} chars)`);
  }

  console.log(`\n✨ Conversión completada!`);
  console.log(`📁 Archivos en: audiobook/content/es/`);
  console.log(`📊 Total: ${files.length} archivos, ${totalChars.toLocaleString()} caracteres\n`);

  // Show some example conversions
  console.log('📝 Ejemplos de conversiones realizadas:');
  console.log('   705,000 → setecientos cinco mil');
  console.log('   75,000 → setenta y cinco mil');
  console.log('   51% → cincuenta y uno por ciento');
  console.log('   11,000 → once mil');
  console.log('   30,000,000 → treinta millones de\n');
}

main().catch(console.error);
