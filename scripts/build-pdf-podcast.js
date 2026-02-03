#!/usr/bin/env node

/**
 * PDF Generation Script for Podcast - book-template
 *
 * Generates clean PDF files without footnotes, ideal for podcast recording.
 * - No glossary terms highlighted
 * - No footnotes
 * - Clean, readable format for narration
 *
 * Usage:
 *   node scripts/build-pdf-podcast.js [language]
 *   node scripts/build-pdf-podcast.js         # Generates ES (default)
 *   node scripts/build-pdf-podcast.js en      # Generates EN
 *
 * Output:
 *   dist/pdf/podcast/ep01-el-creador.pdf
 *   dist/pdf/podcast/ep02-las-densidades.pdf
 *   ...
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

// ============================================================================
// CONFIGURATION
// ============================================================================

const PROJECT_ROOT = process.cwd();
const I18N_DIR = path.join(PROJECT_ROOT, 'i18n');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');
const PODCAST_DIR = path.join(DIST_DIR, 'pdf', 'podcast');

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function loadJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.warn(`Warning: Could not load ${filePath}`);
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
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ============================================================================
// TEXT PROCESSING (NO FOOTNOTES)
// ============================================================================

function processText(text) {
  // Remove {term:id} markers, keep only display text
  let processed = text.replace(/\{term:([^}|]+)(?:\|([^}]+))?\}/g, (match, termId, customText) => {
    return customText || termId.replace(/-/g, ' ');
  });

  // Replace **text** with <strong>
  processed = processed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Replace *text* with <em>
  processed = processed.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  return processed;
}

// ============================================================================
// HTML TEMPLATE GENERATION
// ============================================================================

function generatePodcastHtml(chapter, episodeNum) {
  const sectionsHtml = chapter.sections.map((section, index) => {
    const contentHtml = section.content.map(block => {
      const processedText = processText(block.text);
      if (block.type === 'paragraph') {
        return `<p>${processedText}</p>`;
      } else if (block.type === 'quote') {
        return `<div class="quote">${processedText}</div>`;
      }
      return '';
    }).join('\n');

    return `
      <section class="section">
        <h2>${section.title}</h2>
        ${contentHtml}
      </section>
      ${index < chapter.sections.length - 1 ? '<div class="divider">· · ·</div>' : ''}
    `;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Spectral:ital,wght@0,300;0,400;0,500;1,400&display=swap');

    :root {
      --font-heading: 'Cormorant Garamond', Georgia, serif;
      --font-body: 'Spectral', Georgia, serif;
      --gold: #c9a227;
      --text: #1a1a1a;
      --muted: #666;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: var(--font-body);
      font-size: 12pt;
      line-height: 1.8;
      color: var(--text);
      padding: 0;
    }

    /* Header - compacto */
    .header {
      text-align: center;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid #ddd;
      margin-bottom: 1rem;
    }

    .header-site {
      font-family: var(--font-heading);
      font-size: 9pt;
      color: var(--muted);
      letter-spacing: 0.1em;
    }

    .header-podcast {
      font-family: var(--font-heading);
      font-size: 12pt;
      font-weight: 600;
      color: var(--gold);
      margin-top: 0.15rem;
    }

    /* Episode header */
    .episode-header {
      text-align: center;
      margin-bottom: 1.5rem;
    }

    .episode-num {
      font-family: var(--font-heading);
      font-size: 11pt;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.15em;
      margin-bottom: 0.3rem;
    }

    .episode-title {
      font-family: var(--font-heading);
      font-size: 22pt;
      font-weight: 600;
      color: var(--text);
      line-height: 1.2;
    }

    /* Sections - fluido sin saltos */
    .section {
      margin-bottom: 0.8rem;
    }

    .section h2 {
      font-family: var(--font-heading);
      font-size: 14pt;
      font-weight: 600;
      color: var(--text);
      margin-bottom: 0.5rem;
      margin-top: 0.8rem;
    }

    .section p {
      margin-bottom: 0.6rem;
      text-align: justify;
    }

    .quote {
      margin: 0.8rem 1.5rem;
      padding: 0.6rem 1rem;
      border-left: 2px solid var(--gold);
      font-style: italic;
      color: var(--muted);
    }

    .divider {
      text-align: center;
      color: var(--gold);
      font-size: 12pt;
      margin: 1rem 0;
      letter-spacing: 0.3em;
    }
  </style>
</head>
<body>
  <header class="header">
    <div class="header-site">book-template</div>
    <div class="header-podcast">El Uno - Podcast</div>
  </header>

  <article>
    <header class="episode-header">
      <div class="episode-num">Episodio ${episodeNum}</div>
      <h1 class="episode-title">${chapter.title}</h1>
    </header>

    ${sectionsHtml}
  </article>
</body>
</html>`;
}

// ============================================================================
// PDF GENERATION
// ============================================================================

async function generatePdf(chapter, episodeNum, outputPath) {
  const html = generatePodcastHtml(chapter, episodeNum);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    await page.pdf({
      path: outputPath,
      format: 'Letter',
      margin: {
        top: '0.6in',
        bottom: '0.6in',
        left: '0.75in',
        right: '0.75in'
      },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `
        <div style="width:100%;text-align:center;font-size:9pt;font-family:Georgia,serif;color:#999;">
          <span class="pageNumber"></span>
        </div>
      `
    });

    console.log(`   ✅ ${outputPath}`);
  } finally {
    await browser.close();
  }
}

// ============================================================================
// MAIN BUILD FUNCTION
// ============================================================================

async function buildPodcastPdfs(lang = 'es') {
  console.log(`\n🎙️  Generando PDFs para Podcast (${lang.toUpperCase()})...\n`);

  ensureDir(PODCAST_DIR);

  // Get all chapter files
  const chaptersDir = path.join(I18N_DIR, lang, 'chapters');
  const chapterFiles = fs.readdirSync(chaptersDir)
    .filter(f => f.endsWith('.json'))
    .sort();

  for (const file of chapterFiles) {
    const chNum = file.replace('.json', '');
    const episodeNum = parseInt(chNum);

    // Load chapter
    const chapterPath = path.join(chaptersDir, file);
    const chapter = loadJSON(chapterPath);

    if (!chapter) {
      console.log(`   ⚠️  Skipping ${file} - could not load`);
      continue;
    }

    // Generate filename: ep01-el-creador.pdf
    const slug = slugify(chapter.title);
    const filename = `ep${chNum}-${slug}.pdf`;
    const outputPath = path.join(PODCAST_DIR, filename);

    await generatePdf(chapter, episodeNum, outputPath);
  }

  console.log('\n✨ PDFs para podcast generados!\n');
  console.log(`📁 Ubicación: dist/pdf/podcast/`);
  console.log(`📊 Total: ${chapterFiles.length} episodios\n`);
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  const lang = process.argv[2] || 'es';

  const validLangs = ['en', 'es', 'pt'];
  if (!validLangs.includes(lang)) {
    console.error(`❌ Idioma inválido: ${lang}. Usa: ${validLangs.join(', ')}`);
    process.exit(1);
  }

  await buildPodcastPdfs(lang);
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
