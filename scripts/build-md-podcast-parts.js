#!/usr/bin/env node

/**
 * Markdown Generation Script for Podcast - Split by 6000 chars
 *
 * Generates clean Markdown files split into parts of max 6000 characters.
 * Ideal for Descript transcription input limit.
 *
 * Usage:
 *   node scripts/build-md-podcast-parts.js [language]
 *   node scripts/build-md-podcast-parts.js         # Generates ES (default)
 *   node scripts/build-md-podcast-parts.js en      # Generates EN
 *
 * Output:
 *   dist/podcast/ep01-parte1-cosmologia-y-genesis.md
 *   dist/podcast/ep01-parte2-cosmologia-y-genesis.md
 *   ...
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = process.cwd();
const I18N_DIR = path.join(PROJECT_ROOT, 'i18n');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');
const PODCAST_DIR = path.join(DIST_DIR, 'podcast');
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

  return clean;
}

function generateSections(chapter, glossary) {
  const sections = [];

  chapter.sections.forEach((section, index) => {
    let sectionMd = `## ${section.title}\n\n`;

    section.content.forEach(block => {
      const text = cleanText(block.text, glossary);
      if (block.type === 'quote') {
        sectionMd += `> ${text}\n\n`;
      } else {
        sectionMd += `${text}\n\n`;
      }
    });

    if (index < chapter.sections.length - 1) {
      sectionMd += `---\n\n`;
    }

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

  const baseHeader = `# Episodio ${episodeNum}: ${chapter.title}\n\n`;
  const partHeaderLength = baseHeader.length + 15; // Extra for "(Parte X)"

  for (const section of sections) {
    const sectionLength = section.content.length;

    // If adding this section exceeds limit, start new part
    if (currentLength + sectionLength > MAX_CHARS - partHeaderLength && currentPart.length > 0) {
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
    if (sectionLength > MAX_CHARS - partHeaderLength) {
      // Split section content by paragraphs
      const paragraphs = section.content.split('\n\n');
      let subContent = `## ${section.title}\n\n`;

      for (const para of paragraphs) {
        if (para.trim() === '' || para.startsWith('## ')) continue;

        const paraWithNewlines = para + '\n\n';

        if (subContent.length + paraWithNewlines.length > MAX_CHARS - partHeaderLength && subContent.length > 50) {
          // Save current part
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
            subContent = `## ${section.title} (continuación)\n\n`;
          }
        }

        subContent += paraWithNewlines;
      }

      // Add remaining content
      if (subContent.length > 50) {
        currentPart.push({ title: section.title, content: subContent });
        currentLength += subContent.length;
      }
    } else {
      currentPart.push(section);
      currentLength += sectionLength;
    }
  }

  // Don't forget the last part
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
  if (totalParts === 1) {
    return `# Episodio ${episodeNum}: ${chapter.title}\n\n${content}`;
  }
  return `# Episodio ${episodeNum} (Parte ${partNum}): ${chapter.title}\n\n${content}`;
}

async function buildPodcastMdParts(lang = 'es') {
  console.log(`\n🎙️  Generando Markdown para Podcast en partes (${lang.toUpperCase()})...\n`);

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

  console.log(`\n✨ Markdown para podcast generado!\n`);
  console.log(`📁 Ubicación: dist/podcast/`);
  console.log(`📊 Total: ${totalFiles} archivos\n`);
}

const lang = process.argv[2] || 'es';
buildPodcastMdParts(lang);
