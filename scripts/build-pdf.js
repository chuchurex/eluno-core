#!/usr/bin/env node

/**
 * PDF Generation Script for eluno.org
 *
 * Generates PDF files from chapter JSON content using Puppeteer.
 * Features:
 *   - Header with site name and book title
 *   - Chapter structure matching HTML output
 *   - Glossary terms rendered as footnotes at page bottom
 *   - Letter size (carta) format
 *   - Support for EN, ES, PT languages
 *
 * Usage:
 *   node scripts/build-pdf.js <chapter-number> [language]
 *   node scripts/build-pdf.js 01           # Generates EN, ES, PT
 *   node scripts/build-pdf.js 01 es        # Generates only ES
 *   node scripts/build-pdf.js all          # Generates all chapters
 *   node scripts/build-pdf.js complete     # Generates complete book PDF for all langs
 *
 * Output:
 *   dist/pdf/en/ch01.pdf
 *   dist/pdf/es/ch01.pdf
 *   dist/pdf/pt/ch01.pdf
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

// ============================================================================
// CONFIGURATION
// ============================================================================

const LANGUAGES = ['en', 'es', 'pt'];
const BASE_LANG = 'en';
const PROJECT_ROOT = process.cwd();
const I18N_DIR = path.join(PROJECT_ROOT, 'i18n');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');
const PDF_DIR = path.join(DIST_DIR, 'pdf');

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

// ============================================================================
// TEXT PROCESSING WITH FOOTNOTES
// ============================================================================

/**
 * Process text and collect footnotes for glossary terms and references
 * Returns processed HTML string
 */
function processTextWithFootnotes(text, glossary, references, collectedFootnotes) {
  // Replace {term:id} or {term:id|text} with superscript number
  let processed = text.replace(/\{term:([^}|]+)(?:\|([^}]+))?\}/g, (match, termId, customText) => {
    const term = glossary[termId];
    if (!term) return customText || termId;

    const displayText = customText || term.title;

    // Add to collected footnotes if not already present
    if (!collectedFootnotes.has(termId)) {
      collectedFootnotes.set(termId, { ...term, type: 'term' });
    }

    // Get footnote number (1-indexed position in map)
    const footnoteNum = Array.from(collectedFootnotes.keys()).indexOf(termId) + 1;

    return `<span class="term">${displayText}<sup class="fn-ref">${footnoteNum}</sup></span>`;
  });

  // Remove {ref:id} completely from PDF (references not shown in PDF)
  if (references) {
    processed = processed.replace(/\{ref:([^}]+)\}/g, '');
  }

  // Replace **text** with <strong>
  let html = processed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Replace *text* with <em>
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  return html;
}

// ============================================================================
// HTML TEMPLATE GENERATION
// ============================================================================

function generatePdfHtml(chapter, glossary, references, lang, ui) {
  const collectedFootnotes = new Map();

  // Process all sections and collect footnotes
  const sectionsHtml = chapter.sections.map((section, index) => {
    const contentHtml = section.content.map(block => {
      const processedText = processTextWithFootnotes(block.text, glossary, references, collectedFootnotes);
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

  // Generate footnotes section (only glossary terms, not references)
  const glossaryFootnotes = Array.from(collectedFootnotes.entries()).filter(([id, item]) => item.type !== 'ref');
  const footnotesHtml = glossaryFootnotes.length > 0 ? `
    <div class="footnotes">
      <div class="footnotes-title">${ui.nav.notes || 'Notes'}</div>
      ${glossaryFootnotes.map(([id, item], index) => {
    // Term: show content
    const content = item.content.map(p =>
      p.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    ).join(' ');
    return `<div class="footnote"><sup>${index + 1}</sup> <strong>${item.title}:</strong> ${content}</div>`;
  }).join('\n')}
    </div>
  ` : '';

  return `<!DOCTYPE html>
<html lang="${lang}">
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
      font-size: 11pt;
      line-height: 1.7;
      color: var(--text);
      padding: 0;
    }

    /* Header - appears on every page via @page */
    .header {
      text-align: center;
      padding-bottom: 1rem;
      border-bottom: 1px solid #ddd;
      margin-bottom: 2rem;
    }

    .header-site {
      font-family: var(--font-heading);
      font-size: 10pt;
      color: var(--muted);
      letter-spacing: 0.1em;
    }

    .header-book {
      font-family: var(--font-heading);
      font-size: 14pt;
      font-weight: 600;
      color: var(--gold);
      margin-top: 0.25rem;
    }

    /* Chapter header */
    .chapter-header {
      text-align: center;
      margin-bottom: 2.5rem;
      page-break-after: avoid;
    }

    .chapter-num {
      font-family: var(--font-heading);
      font-size: 12pt;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.15em;
      margin-bottom: 0.5rem;
    }

    .chapter-title {
      font-family: var(--font-heading);
      font-size: 24pt;
      font-weight: 600;
      color: var(--text);
      line-height: 1.2;
    }

    /* Sections */
    .section {
      margin-bottom: 2rem;
    }

    .section h2 {
      font-family: var(--font-heading);
      font-size: 14pt;
      font-weight: 600;
      color: var(--text);
      margin-bottom: 1rem;
      page-break-after: avoid;
    }

    .section p {
      margin-bottom: 1rem;
      text-align: justify;
      text-indent: 1.5em;
    }

    .section p:first-of-type {
      text-indent: 0;
    }

    .quote {
      margin: 1.5rem 2rem;
      padding: 1rem 1.5rem;
      border-left: 3px solid var(--gold);
      font-style: italic;
      color: var(--muted);
      background: #fafafa;
    }

    .divider {
      text-align: center;
      color: var(--gold);
      font-size: 14pt;
      margin: 2rem 0;
      letter-spacing: 0.5em;
    }

    /* Terms and footnote references */
    .term {
      /* No special styling for PDF - just normal text */
    }

    .fn-ref {
      font-size: 8pt;
      color: var(--gold);
      margin-left: 1px;
    }

    /* Footnotes section */
    .footnotes {
      margin-top: 3rem;
      padding-top: 1rem;
      border-top: 1px solid #ddd;
      page-break-inside: avoid;
    }

    .footnotes-title {
      font-family: var(--font-heading);
      font-size: 11pt;
      font-weight: 600;
      color: var(--muted);
      margin-bottom: 0.75rem;
    }

    .footnote {
      font-size: 9pt;
      line-height: 1.5;
      margin-bottom: 0.5rem;
      color: var(--muted);
    }

    .footnote sup {
      color: var(--gold);
      font-weight: 600;
      margin-right: 0.25rem;
    }

    /* Page breaks */
    .section {
      page-break-inside: avoid;
    }

    h2 {
      page-break-after: avoid;
    }
  </style>
</head>
<body>
  <header class="header">
    <div class="header-site">${ui.siteTitle}</div>
    <div class="header-book">${ui.bookTitle}</div>
  </header>

  <article>
    <header class="chapter-header">
      <div class="chapter-num">${chapter.numberText}</div>
      <h1 class="chapter-title">${chapter.title}</h1>
    </header>

    ${sectionsHtml}
  </article>

  ${footnotesHtml}
</body>
</html>`;
}

// ============================================================================
// PDF GENERATION
// ============================================================================

async function generatePdf(chapter, glossary, references, lang, ui, outputPath) {
  const html = generatePdfHtml(chapter, glossary, references, lang, ui);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    await page.pdf({
      path: outputPath,
      format: 'Letter', // Carta size
      margin: {
        top: '1in',
        bottom: '1in',
        left: '1in',
        right: '1in'
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

function loadUI(lang) {
  const uiPath = path.join(I18N_DIR, lang, 'ui.json');
  const ui = loadJSON(uiPath);
  if (!ui) {
      // Fallback to English if not found, but we expect it to exist
      return loadJSON(path.join(I18N_DIR, BASE_LANG, 'ui.json')) || {};
  }
  return ui;
}

async function buildPdf(chapterNum, targetLang = null) {
  const chNum = String(chapterNum).padStart(2, '0');
  const langs = targetLang ? [targetLang] : LANGUAGES;

  console.log(`\n📄 Generating PDFs for Chapter ${chNum}...\n`);

  for (const lang of langs) {
    // Ensure output directory exists
    const langPdfDir = path.join(PDF_DIR, lang);
    ensureDir(langPdfDir);

    // Load UI strings
    const ui = loadUI(lang);

    // Load chapter
    const chapterPath = path.join(I18N_DIR, lang, 'chapters', `${chNum}.json`);
    const chapter = loadJSON(chapterPath);

    if (!chapter) {
      console.log(`   ⚠️  Skipping ${lang.toUpperCase()} - chapter not found`);
      continue;
    }

    // Load glossary
    const glossaryPath = path.join(I18N_DIR, lang, 'glossary.json');
    let glossary = loadJSON(glossaryPath);
    if (!glossary) {
      glossary = loadJSON(path.join(I18N_DIR, BASE_LANG, 'glossary.json')) || {};
    }

    // Load references
    const referencesPath = path.join(I18N_DIR, lang, 'references.json');
    let references = loadJSON(referencesPath);
    if (!references) {
      references = loadJSON(path.join(I18N_DIR, BASE_LANG, 'references.json')) || {};
    }

    // Generate PDF
    const outputPath = path.join(langPdfDir, `ch${chNum}.pdf`);
    await generatePdf(chapter, glossary, references, lang, ui, outputPath);
  }
}

async function buildAllPdfs(targetLang = null) {
  console.log('\n📚 Generating all PDFs...\n');

  // Get all chapter files
  const chaptersDir = path.join(I18N_DIR, BASE_LANG, 'chapters');
  const chapterFiles = fs.readdirSync(chaptersDir)
    .filter(f => f.endsWith('.json'))
    .sort();

  for (const file of chapterFiles) {
    const chNum = file.replace('.json', '');
    await buildPdf(chNum, targetLang);
  }

  console.log('\n✨ All PDFs generated!\n');
}

async function buildCompleteBookPdf(targetLang = null) {
  const langs = targetLang ? [targetLang] : LANGUAGES;
  console.log(`\n📚 Generating Complete Book PDF...\n`);

  for (const lang of langs) {
    const langPdfDir = path.join(PDF_DIR, lang);
    ensureDir(langPdfDir);

    const ui = loadUI(lang);

    // Load all chapters
    const chaptersDir = path.join(I18N_DIR, lang, 'chapters');
    if (!fs.existsSync(chaptersDir)) {
      console.log(`   ⚠️  Skipping ${lang.toUpperCase()} - chapters directory not found`);
      continue;
    }

    const chapterFiles = fs.readdirSync(chaptersDir)
      .filter(f => f.endsWith('.json'))
      .sort();

    const chapters = chapterFiles.map(f => loadJSON(path.join(chaptersDir, f))).filter(Boolean);

    if (chapters.length === 0) {
      console.log(`   ⚠️  Skipping ${lang.toUpperCase()} - no chapters found`);
      continue;
    }

    // Load glossary
    const glossaryPath = path.join(I18N_DIR, lang, 'glossary.json');
    let glossary = loadJSON(glossaryPath);
    if (!glossary) {
      glossary = loadJSON(path.join(I18N_DIR, BASE_LANG, 'glossary.json')) || {};
    }

    // Load references
    const referencesPath = path.join(I18N_DIR, lang, 'references.json');
    let references = loadJSON(referencesPath);
    if (!references) {
      references = loadJSON(path.join(I18N_DIR, BASE_LANG, 'references.json')) || {};
    }

    const collectedFootnotes = new Map();

    // Compile sections from all chapters
    const chaptersHtml = chapters.map((chapter) => {
      const sectionsHtml = chapter.sections.map((section, index) => {
        const contentHtml = section.content.map(block => {
          const processedText = processTextWithFootnotes(block.text, glossary, references, collectedFootnotes);
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
        `;
      }).join('\n');

      return `
        <div class="chapter-wrapper" style="page-break-before: always;">
          <header class="chapter-header">
            <div class="chapter-num">${chapter.numberText}</div>
            <h1 class="chapter-title">${chapter.title}</h1>
          </header>
          ${sectionsHtml}
        </div>
      `;
    }).join('\n');

    // Generate footnotes section (only glossary terms, not references)
    const glossaryFootnotes = Array.from(collectedFootnotes.entries()).filter(([id, item]) => item.type !== 'ref');
    const footnotesHtml = glossaryFootnotes.length > 0 ? `
      <div class="footnotes" style="page-break-before: always;">
        <div class="footnotes-title">${ui.nav.notesPanel || 'Glossary'}</div>
        ${glossaryFootnotes.map(([id, item], index) => {
      // Term: show content
      const content = item.content.map(p =>
        p.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      ).join(' ');
      return `<div class="footnote"><sup>${index + 1}</sup> <strong>${item.title}:</strong> ${content}</div>`;
    }).join('\n')}
      </div>
    ` : '';

    const html = `<!DOCTYPE html>
<html lang="${lang}">
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

    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: var(--font-body); font-size: 11pt; line-height: 1.7; color: var(--text); }
    .header { text-align: center; padding-bottom: 1rem; border-bottom: 1px solid #ddd; margin-bottom: 2rem; }
    .header-site { font-family: var(--font-heading); font-size: 10pt; color: var(--muted); letter-spacing: 0.1em; }
    .header-book { font-family: var(--font-heading); font-size: 14pt; font-weight: 600; color: var(--gold); margin-top: 0.25rem; }
    .chapter-header { text-align: center; margin-bottom: 2.5rem; }
    .chapter-num { font-family: var(--font-heading); font-size: 12pt; color: var(--muted); text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 0.5rem; }
    .chapter-title { font-family: var(--font-heading); font-size: 24pt; font-weight: 600; color: var(--text); line-height: 1.2; }
    .section { margin-bottom: 2rem; page-break-inside: avoid; }
    .section h2 { font-family: var(--font-heading); font-size: 14pt; font-weight: 600; color: var(--text); margin-bottom: 1rem; page-break-after: avoid; }
    .section p { margin-bottom: 1rem; text-align: justify; text-indent: 1.5em; }
    .section p:first-of-type { text-indent: 0; }
    .quote { margin: 1.5rem 2rem; padding: 1rem 1.5rem; border-left: 3px solid var(--gold); font-style: italic; color: var(--muted); background: #fafafa; }
    .divider { text-align: center; color: var(--gold); font-size: 14pt; margin: 2rem 0; letter-spacing: 0.5em; }
    .term { /* No special styling for PDF - just normal text */ }
    .fn-ref { font-size: 8pt; color: var(--gold); margin-left: 1px; }
    .footnotes { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #ddd; }
    .footnotes-title { font-family: var(--font-heading); font-size: 14pt; font-weight: 600; color: var(--gold); margin-bottom: 1.5rem; text-align: center; }
    .footnote { font-size: 9pt; line-height: 1.5; margin-bottom: 0.75rem; color: var(--muted); }
    .footnote sup { color: var(--gold); font-weight: 600; margin-right: 0.25rem; }
  </style>
</head>
<body>
  <header class="header">
    <div class="header-site">${ui.siteTitle}</div>
    <div class="header-book">${ui.bookTitle}</div>
  </header>
  <div class="title-page" style="height: 80vh; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center;">
    <h1 style="font-family: var(--font-heading); font-size: 48pt; color: var(--text); margin-bottom: 1rem;">${ui.bookTitle}</h1>
    <p style="font-family: var(--font-heading); font-size: 18pt; color: var(--gold);">${ui.siteTitle}</p>
  </div>
  ${chaptersHtml}
  ${footnotesHtml}
</body>
</html>`;

    const outputPath = path.join(langPdfDir, `complete-book.pdf`);

    // Launch browser separately for complete book to handle potentially larger document
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
        margin: { top: '1in', bottom: '1in', left: '1in', right: '1in' },
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate: `
          <div style="width:100%;text-align:center;font-size:9pt;font-family:Georgia,serif;color:#999;">
            <span class="pageNumber"></span> / <span class="totalPages"></span>
          </div>
        `
      });

      console.log(`   ✅ ${outputPath}`);
    } finally {
      await browser.close();
    }
  }

  console.log('\n✨ Complete book PDFs generated!\n');
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
📄 PDF Generation Script for eluno.org

Usage:
  node scripts/build-pdf.js <chapter-number> [language]
  node scripts/build-pdf.js all [language]
  node scripts/build-pdf.js complete [language]

Examples:
  node scripts/build-pdf.js 01           # Generate ch01 in EN, ES, PT
  node scripts/build-pdf.js 01 es        # Generate ch01 only in ES
  node scripts/build-pdf.js all          # Generate all chapters in all languages
  node scripts/build-pdf.js complete     # Generate complete book in all languages
  node scripts/build-pdf.js complete es  # Generate complete book only in ES
  node scripts/build-pdf.js all pt       # Generate all chapters only in PT

Output:
  dist/pdf/{lang}/ch{XX}.pdf
`);
    process.exit(0);
  }

  const chapterArg = args[0];
  const langArg = args[1] || null;

  // Validate language if provided
  if (langArg && !LANGUAGES.includes(langArg)) {
    console.error(`❌ Invalid language: ${langArg}. Use: ${LANGUAGES.join(', ')}`);
    process.exit(1);
  }

  if (chapterArg === 'all') {
    await buildAllPdfs(langArg);
  } else if (chapterArg === 'complete') {
    await buildCompleteBookPdf(langArg);
  } else {
    const chapterNum = parseInt(chapterArg);
    if (isNaN(chapterNum) || chapterNum < 1 || chapterNum > 99) {
      console.error('❌ Invalid chapter number. Use 1-99 or "all"');
      process.exit(1);
    }
    await buildPdf(chapterNum, langArg);
  }
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
