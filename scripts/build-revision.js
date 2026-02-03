/**
 * Build revision.html from chapter files
 * Creates a single-page HTML with all chapters for review
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = process.cwd();
const I18N_DIR = path.join(PROJECT_ROOT, 'i18n');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');
const LANG = 'es'; // Default to Spanish

function loadJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.warn(`Warning: Could not load ${filePath}`);
    return null;
  }
}

function buildRevisionHTML() {
  console.log('📄 Building revision.html...');

  const chaptersDir = path.join(I18N_DIR, LANG, 'chapters');
  const chapterFiles = fs.readdirSync(chaptersDir)
    .filter(f => f.endsWith('.json'))
    .sort();

  let html = `<!DOCTYPE html>
<html lang="${LANG}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Las Enseñanzas de la Ley del Uno - Revisión v3.1</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: Georgia, 'Times New Roman', serif;
      line-height: 1.8;
      max-width: 720px;
      margin: 0 auto;
      padding: 2rem;
      background: #fefefe;
      color: #2a2a2a;
    }
    h1 {
      font-size: 2rem;
      text-align: center;
      margin-bottom: 0.5rem;
      font-weight: normal;
      letter-spacing: 0.1em;
    }
    .subtitle {
      text-align: center;
      font-style: italic;
      color: #666;
      margin-bottom: 3rem;
    }
    h2 {
      font-size: 1.4rem;
      margin-top: 4rem;
      margin-bottom: 2rem;
      font-weight: normal;
      border-bottom: 1px solid #ddd;
      padding-bottom: 0.5rem;
    }
    .chapter-num {
      font-size: 0.9rem;
      color: #888;
      letter-spacing: 0.2em;
      text-transform: uppercase;
    }
    p {
      margin-bottom: 1.5rem;
      text-align: justify;
      text-indent: 1.5rem;
    }
    p:first-of-type,
    h2 + p {
      text-indent: 0;
    }
    .version-info {
      text-align: center;
      color: #999;
      font-size: 0.9rem;
      margin-top: 4rem;
      padding-top: 2rem;
      border-top: 1px solid #eee;
    }
  </style>
</head>
<body>
  <h1>Las Enseñanzas de la Ley del Uno</h1>
  <div class="subtitle">Una invitación a recordar</div>
`;

  // Process each chapter
  chapterFiles.forEach(file => {
    const chapter = loadJSON(path.join(chaptersDir, file));
    if (!chapter) return;

    html += `\n  <h2>
    <div class="chapter-num">${chapter.numberText}</div>
    ${chapter.title}
  </h2>\n`;

    // Process sections
    if (chapter.sections) {
      chapter.sections.forEach(section => {
        if (section.content) {
          section.content.forEach(block => {
            if (block.type === 'paragraph') {
              html += `  <p>${block.text}</p>\n`;
            }
          });
        }
      });
    }
  });

  html += `
  <div class="version-info">
    Versión 3.1 — Generado el ${new Date().toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })}
  </div>
</body>
</html>`;

  const outputPath = path.join(DIST_DIR, 'revision.html');
  fs.writeFileSync(outputPath, html, 'utf8');
  console.log(`✅ Created ${outputPath}`);
}

// Execute
buildRevisionHTML();
