#!/usr/bin/env node

/**
 * Markdown Generation Script for Podcast - Plain Text Version
 *
 * Generates clean plain-text Markdown files split into parts of max 6000 characters.
 * - No titles in sub-parts (only in first part, without "Parte 1")
 * - No ** for subtitles, uses extra line breaks instead
 * - Numbers converted to Spanish text for TTS
 *
 * Usage:
 *   node scripts/build-md-podcast-plain.js [language]
 *   node scripts/build-md-podcast-plain.js         # Generates ES (default)
 *
 * Output:
 *   dist/podcast-md/ep01-parte1-cosmologia-y-genesis.md
 *   dist/podcast-md/ep01-parte2-cosmologia-y-genesis.md
 *   ...
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = process.cwd();
const I18N_DIR = path.join(PROJECT_ROOT, 'i18n');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');
const PODCAST_DIR = path.join(DIST_DIR, 'podcast-md');
const MAX_CHARS = 6000;

function loadJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return null;
  }
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

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

  // Millions
  if (num >= 1000000) {
    const millions = Math.floor(num / 1000000);
    if (millions === 1) {
      result += 'un millón ';
    } else {
      result += numberToSpanish(millions) + ' millones ';
    }
    num %= 1000000;
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
  // Handle numbers with dots as thousands separators (e.g., 25.000 -> veinticinco mil)
  text = text.replace(/(\d{1,3})\.(\d{3})\.(\d{3})/g, (match, p1, p2, p3) => {
    const num = parseInt(p1 + p2 + p3);
    return numberToSpanish(num);
  });

  text = text.replace(/(\d{1,3})\.(\d{3})/g, (match, p1, p2) => {
    const num = parseInt(p1 + p2);
    return numberToSpanish(num);
  });

  // Handle ordinals (1ª, 2ª, 3ª, etc.)
  const ordinalsFem = {
    '1ª': 'primera', '2ª': 'segunda', '3ª': 'tercera', '4ª': 'cuarta', '5ª': 'quinta',
    '6ª': 'sexta', '7ª': 'séptima', '8ª': 'octava', '9ª': 'novena', '10ª': 'décima'
  };
  const ordinalsMasc = {
    '1º': 'primero', '2º': 'segundo', '3º': 'tercero', '4º': 'cuarto', '5º': 'quinto',
    '6º': 'sexto', '7º': 'séptimo', '8º': 'octavo', '9º': 'noveno', '10º': 'décimo'
  };

  for (const [num, word] of Object.entries(ordinalsFem)) {
    text = text.replace(new RegExp(num, 'g'), word);
  }
  for (const [num, word] of Object.entries(ordinalsMasc)) {
    text = text.replace(new RegExp(num, 'g'), word);
  }

  // Handle remaining standalone numbers
  text = text.replace(/\b(\d+)\b/g, (match) => {
    const num = parseInt(match);
    if (num <= 1000000) {
      return numberToSpanish(num);
    }
    return match;
  });

  return text;
}

// Fallback translations for terms not in glossary
const FALLBACK_ES = {
  'holographic': 'holográfica',
  'spiral': 'espiral',
  'photon': 'fotón',
  'rays': 'rayos',
  'self-awareness': 'autoconciencia',
  'the-choice': 'la elección',
  'illusion': 'ilusión',
  'fractal': 'fractal',
  'indras-net': 'la red de Indra',
  'kybalion': 'el Kybalion',
  'catalyst': 'catalizadores'
};

function cleanText(text, glossary) {
  let clean = text.replace(/\{term:([^}|]+)(?:\|([^}]+))?\}/g, (match, termId, customText) => {
    if (customText) return customText;
    if (glossary && glossary[termId]) return glossary[termId].title;
    if (FALLBACK_ES[termId]) return FALLBACK_ES[termId];
    return termId.replace(/-/g, ' ');
  });

  clean = clean.replace(/\{ref:[^}]+\}/g, '');
  clean = clean.replace(/\*\*([^*]+)\*\*/g, '$1');
  clean = clean.replace(/\*([^*]+)\*/g, '$1');
  clean = clean.replace(/los Catalizador /g, 'los catalizadores ');
  clean = clean.replace(/los Densidades/g, 'las densidades');

  // Convert numbers to text
  clean = convertNumbersToText(clean);

  return clean;
}

function generateSections(chapter, glossary) {
  const sections = [];

  chapter.sections.forEach((section, index) => {
    // Subtitle with extra line breaks (no ** markers)
    let sectionMd = `\n${section.title}\n\n`;

    section.content.forEach(block => {
      const text = cleanText(block.text, glossary);
      if (block.type === 'quote') {
        sectionMd += `${text}\n\n`;
      } else {
        sectionMd += `${text}\n\n`;
      }
    });

    sections.push({
      title: section.title,
      content: sectionMd
    });
  });

  return sections;
}

function splitIntoParts(chapter, glossary, episodeNum) {
  const sections = generateSections(chapter, glossary);
  const parts = [];
  let currentPart = [];
  let currentLength = 0;
  let partNum = 1;

  // Header only for first part
  const headerLength = `Episodio ${episodeNum}: ${chapter.title}\n\n`.length;

  for (const section of sections) {
    const sectionLength = section.content.length;

    // If adding this section exceeds limit, start new part
    if (currentLength + sectionLength > MAX_CHARS - headerLength && currentPart.length > 0) {
      parts.push({
        partNum,
        sections: currentPart,
        content: currentPart.map(s => s.content).join('')
      });
      partNum++;
      currentPart = [];
      currentLength = 0;
    }

    // If single section is too long, we need to split it by paragraphs
    if (sectionLength > MAX_CHARS - headerLength) {
      const paragraphs = section.content.split('\n\n');
      let subContent = `\n${section.title}\n\n`;

      for (const para of paragraphs) {
        if (para.trim() === '' || para === section.title) continue;

        const paraWithNewlines = para + '\n\n';

        if (subContent.length + paraWithNewlines.length > MAX_CHARS - headerLength && subContent.length > 50) {
          if (currentPart.length > 0 || subContent.length > 50) {
            const allContent = currentPart.map(s => s.content).join('') + subContent;
            parts.push({
              partNum,
              sections: [...currentPart, { title: section.title + ' (cont.)', content: subContent }],
              content: allContent
            });
            partNum++;
            currentPart = [];
            currentLength = 0;
            subContent = `\n${section.title} (continuación)\n\n`;
          }
        }

        subContent += paraWithNewlines;
      }

      if (subContent.length > 50) {
        currentPart.push({ title: section.title, content: subContent });
        currentLength += subContent.length;
      }
    } else {
      currentPart.push(section);
      currentLength += sectionLength;
    }
  }

  if (currentPart.length > 0) {
    parts.push({
      partNum,
      sections: currentPart,
      content: currentPart.map(s => s.content).join('')
    });
  }

  return parts;
}

function formatPart(chapter, partNum, totalParts, content, episodeNum) {
  // Only first part gets the title (without "Parte 1")
  if (partNum === 1) {
    return `Episodio ${episodeNum}: ${chapter.title}\n\n${content}`;
  }
  // Sub-parts have no title
  return content.trim() + '\n';
}

async function buildPodcastMdParts(lang = 'es') {
  console.log(`\n🎙️  Generando Markdown plano para Podcast (${lang.toUpperCase()})...\n`);

  ensureDir(PODCAST_DIR);

  const glossaryPath = path.join(I18N_DIR, lang, 'glossary.json');
  const glossary = loadJSON(glossaryPath) || {};

  const chaptersDir = path.join(I18N_DIR, lang, 'chapters');
  const chapterFiles = fs.readdirSync(chaptersDir)
    .filter(f => f.endsWith('.json'))
    .sort();

  let totalFiles = 0;

  for (const file of chapterFiles) {
    const chNum = file.replace('.json', '');
    const episodeNum = parseInt(chNum);

    const chapter = loadJSON(path.join(chaptersDir, file));
    if (!chapter) continue;

    const slug = slugify(chapter.title);
    const parts = splitIntoParts(chapter, glossary, episodeNum);

    for (const part of parts) {
      const formatted = formatPart(chapter, part.partNum, parts.length, part.content, episodeNum);

      let filename;
      if (parts.length === 1) {
        filename = `ep${chNum}-${slug}.md`;
      } else {
        filename = `ep${chNum}-parte${part.partNum}-${slug}.md`;
      }

      const outputPath = path.join(PODCAST_DIR, filename);
      fs.writeFileSync(outputPath, formatted);

      const charCount = formatted.length;
      console.log(`   ✅ ${filename} (${charCount} chars)`);
      totalFiles++;
    }
  }

  console.log(`\n✨ Markdown plano para podcast generado!\n`);
  console.log(`📁 Ubicación: dist/podcast-md/`);
  console.log(`📊 Total: ${totalFiles} archivos\n`);
}

const lang = process.argv[2] || 'es';
buildPodcastMdParts(lang);
