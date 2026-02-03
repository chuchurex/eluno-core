#!/usr/bin/env node

/**
 * Automated Chapter Translation Script for book-template
 *
 * This script automates the complete translation workflow:
 * 1. Translates a chapter from English to Spanish and Portuguese
 * 2. Updates navigation in index.html files
 * 3. Rebuilds the site
 * 4. Creates git commits
 * 5. Updates CONTEXT.md (single source of truth for project status)
 * 6. Optionally pushes to remote
 *
 * Usage:
 *   node scripts/translate-chapter.js <chapter-number>
 *   node scripts/translate-chapter.js 05 --no-push
 *
 * Prerequisites:
 *   - Chapter must exist in i18n/en/chapters/XX.json
 *   - AI translation service or manual translation required
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ============================================================================
// CONFIGURATION
// ============================================================================

const GLOSSARY = {
  // Ra Material terminology - STRICT CONSISTENCY REQUIRED
  en: {
    'Harvest': 'Harvest',
    'Distortion': 'Distortion',
    'Catalyst': 'Catalyst',
    'Density': 'Density',
    'Service to Others': 'Service to Others',
    'Service to Self': 'Service to Self',
    'Free Will': 'Free Will',
    'The Veil': 'The Veil',
    'Logos': 'Logos',
    'Intelligent Infinity': 'Intelligent Infinity',
    'Social Memory Complex': 'Social Memory Complex',
    'Mind/Body/Spirit Complex': 'Mind/Body/Spirit Complex',
    'Wanderer': 'Wanderer',
    'Confederation': 'Confederation',
    'Orion Group': 'Orion Group'
  },
  es: {
    'Harvest': 'Cosecha',
    'Distortion': 'Distorsión',
    'Catalyst': 'Catalizador',
    'Density': 'Densidad',
    'Service to Others': 'Servicio a Otros',
    'Service to Self': 'Servicio a Sí Mismo',
    'Free Will': 'Libre Albedrío',
    'The Veil': 'El Velo',
    'Logos': 'Logos',
    'Intelligent Infinity': 'Infinito Inteligente',
    'Social Memory Complex': 'Complejo de Memoria Social',
    'Mind/Body/Spirit Complex': 'Complejo Mente/Cuerpo/Espíritu',
    'Wanderer': 'Errante',
    'Confederation': 'Confederación',
    'Orion Group': 'Grupo de Orión'
  },
  pt: {
    'Harvest': 'Colheita',
    'Distortion': 'Distorção',
    'Catalyst': 'Catalisador',
    'Density': 'Densidade',
    'Service to Others': 'Serviço aos Outros',
    'Service to Self': 'Serviço a Si Mesmo',
    'Free Will': 'Livre Arbítrio',
    'The Veil': 'O Véu',
    'Logos': 'Logos',
    'Intelligent Infinity': 'Infinito Inteligente',
    'Social Memory Complex': 'Complexo de Memória Social',
    'Mind/Body/Spirit Complex': 'Complexo Mente/Corpo/Espírito',
    'Wanderer': 'Andarilho',
    'Confederation': 'Confederação',
    'Orion Group': 'Grupo de Órion'
  }
};

const PROJECT_ROOT = process.cwd();
const PATHS = {
  i18n: path.join(PROJECT_ROOT, 'i18n'),
  indexHtml: path.join(PROJECT_ROOT, 'index.html'),
  esIndexHtml: path.join(PROJECT_ROOT, 'es', 'index.html'),
  contextMd: path.join(PROJECT_ROOT, 'docs', 'CONTEXT.md')
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function loadJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error(`❌ Error loading ${filePath}: ${e.message}`);
    return null;
  }
}

function saveJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
    return true;
  } catch (e) {
    console.error(`❌ Error saving ${filePath}: ${e.message}`);
    return false;
  }
}

function exec(command, description) {
  try {
    console.log(`   🔧 ${description}...`);
    const result = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    return { success: true, output: result };
  } catch (e) {
    return { success: false, error: e.message, output: e.stdout };
  }
}

function getTimestamp() {
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.toTimeString().split(' ')[0].substring(0, 5);
  return `${date} ${time}`;
}

// ============================================================================
// CONTEXT.MD UPDATE FUNCTION
// ============================================================================

function updateContextMd(chapterNum) {
  const chNumber = parseInt(chapterNum);
  console.log('\n📋 Step 7: Updating CONTEXT.md...');

  if (!fs.existsSync(PATHS.contextMd)) {
    console.log('   ⚠️  CONTEXT.md not found at', PATHS.contextMd);
    return false;
  }

  let content = fs.readFileSync(PATHS.contextMd, 'utf8');
  const timestamp = getTimestamp();

  // 1. Update chapter row: change ⏳ to ✅ in "Publicado" column
  // Pattern: | 7 | The Harvest | ✅ | ⏳ |
  const chapterRowRegex = new RegExp(
    `(\\| ${chNumber} \\| [^|]+ \\| ✅ \\| )⏳( \\|)`,
    'g'
  );
  
  if (chapterRowRegex.test(content)) {
    content = content.replace(chapterRowRegex, '$1✅$2');
    console.log(`   ✅ Marked chapter ${chNumber} as published`);
  } else {
    // Try alternative: chapter might have been marked with -
    const altRegex = new RegExp(
      `(\\| ${chNumber} \\| [^|]+ \\| ✅ \\| )-( \\|)`,
      'g'
    );
    if (altRegex.test(content)) {
      content = content.replace(altRegex, '$1✅$2');
      console.log(`   ✅ Marked chapter ${chNumber} as published`);
    } else {
      console.log(`   ℹ️  Chapter ${chNumber} row pattern not matched (may already be ✅)`);
    }
  }

  // 2. Update "Capítulos publicados" counter
  // Pattern: | **Capítulos publicados** | 6 de 16 | 2025-12-28 09:43 |
  const publishedRegex = /(\| \*\*Capítulos publicados\*\* \| )(\d+)( de 16 \| )[^|]+( \|)/;
  const publishedMatch = content.match(publishedRegex);
  
  if (publishedMatch) {
    const currentPublished = parseInt(publishedMatch[2]);
    // Only increment if this chapter is greater than current count
    if (chNumber > currentPublished) {
      const newCount = chNumber; // Since chapters are sequential, chapter number = published count
      content = content.replace(
        publishedRegex,
        `$1${newCount}$3${timestamp}$4`
      );
      console.log(`   ✅ Updated published count: ${currentPublished} → ${newCount}`);
    } else {
      // Just update timestamp
      content = content.replace(
        publishedRegex,
        `$1${currentPublished}$3${timestamp}$4`
      );
      console.log(`   ✅ Updated timestamp (count unchanged)`);
    }
  }

  // 3. Update "Próximo Paso" section
  const nextChapter = chNumber + 1;
  if (nextChapter <= 16) {
    // Update the "Ahora" line to show next chapter to publish
    const ahoraRegex = /(\*\*Ahora:\*\* )Publicar capítulo \d+/;
    const despuesRegex = /(\*\*Después:\*\* )Escribir capítulo \d+/;
    
    // Check if next chapter is already written
    const nextChapterWrittenRegex = new RegExp(`\\| ${nextChapter} \\| [^|]+ \\| ✅ \\|`);
    const nextChapterIsWritten = nextChapterWrittenRegex.test(content);
    
    if (nextChapterIsWritten) {
      content = content.replace(ahoraRegex, `$1Publicar capítulo ${nextChapter}`);
      content = content.replace(despuesRegex, `$1Escribir capítulo ${nextChapter + 1}`);
    } else {
      content = content.replace(ahoraRegex, `$1Escribir capítulo ${nextChapter}`);
      content = content.replace(despuesRegex, `$1Publicar capítulo ${nextChapter}`);
    }
    console.log(`   ✅ Updated next steps`);
  }

  // Save updated content
  try {
    fs.writeFileSync(PATHS.contextMd, content, 'utf8');
    console.log('   ✅ CONTEXT.md saved');
    return true;
  } catch (e) {
    console.error(`   ❌ Error saving CONTEXT.md: ${e.message}`);
    return false;
  }
}

// ============================================================================
// TRANSLATION PROMPT GENERATOR
// ============================================================================

function generateTranslationPrompt(chapterData, targetLang) {
  const langNames = { es: 'español', pt: 'português' };
  const glossaryList = Object.entries(GLOSSARY.en)
    .map(([en, _]) => `- ${en} = ${GLOSSARY[targetLang][en]}`)
    .join('\n');

  return `Traduce el siguiente capítulo del Material de Ra al ${langNames[targetLang]}.

REGLAS ESTRICTAS DE TRADUCCIÓN:

1. **Consistencia Terminológica Absoluta**: Usa SIEMPRE estas traducciones exactas:
${glossaryList}

2. **Estilo de Traducción**:
   - Mantén el tono filosófico, educativo y reverente al misterio
   - Traduce de manera literal y fiel al original (evita creatividad excesiva)
   - Preserva la estructura JSON exactamente como está
   - Mantén los {term:...} tags sin modificar
   - No inventes adornos ni modismos locales

3. **Qué Traducir**:
   - "numberText": Traduce a "${targetLang === 'es' ? 'Capítulo Cinco' : 'Capítulo Cinco'}"
   - "title": Traduce el título
   - "sections[].title": Traduce títulos de secciones
   - "sections[].content[].text": Traduce el contenido

4. **Qué NO Traducir**:
   - "id", "number": Mantén sin cambios
   - "type": Mantén "paragraph", "quote" sin traducir
   - {term:...}: No traduzcas los IDs dentro de las llaves
   - metadata (si existe): No traducir

5. **Formato JSON**:
   - Mantén la estructura exacta del JSON
   - Usa comillas dobles (")
   - Escapa caracteres especiales correctamente
   - Mantén la sangría de 2 espacios

CAPÍTULO A TRADUCIR:

\`\`\`json
${JSON.stringify(chapterData, null, 2)}
\`\`\`

RESPONDE ÚNICAMENTE CON EL JSON TRADUCIDO, SIN EXPLICACIONES ADICIONALES.`;
}

// ============================================================================
// TRANSLATION WORKFLOW
// ============================================================================

async function translateChapter(chapterNum) {
  const chNum = String(chapterNum).padStart(2, '0');
  console.log(`\n🌐 Starting translation workflow for Chapter ${chNum}\n`);

  // Step 1: Load source chapter
  console.log('📖 Step 1: Loading source chapter...');
  const sourcePath = path.join(PATHS.i18n, 'en', 'chapters', `${chNum}.json`);
  const sourceChapter = loadJSON(sourcePath);

  if (!sourceChapter) {
    console.error(`❌ Chapter ${chNum} not found in English`);
    process.exit(1);
  }

  console.log(`   ✅ Loaded: "${sourceChapter.title}"`);

  // Step 2: Display translation prompts
  console.log('\n📝 Step 2: Translation prompts generated\n');
  console.log('═'.repeat(80));
  console.log('SPANISH TRANSLATION PROMPT:');
  console.log('═'.repeat(80));
  console.log(generateTranslationPrompt(sourceChapter, 'es'));
  console.log('\n' + '═'.repeat(80));
  console.log('PORTUGUESE TRANSLATION PROMPT:');
  console.log('═'.repeat(80));
  console.log(generateTranslationPrompt(sourceChapter, 'pt'));
  console.log('═'.repeat(80));

  console.log('\n⚠️  MANUAL STEP REQUIRED:');
  console.log('   1. Copy the prompts above');
  console.log('   2. Use an AI translation service (Claude, GPT-4, Gemini)');
  console.log('   3. Save the translations to:');
  console.log(`      - i18n/es/chapters/${chNum}.json`);
  console.log(`      - i18n/pt/chapters/${chNum}.json`);
  console.log('\n   Press ENTER when translations are ready...');

  // Wait for user confirmation
  await new Promise(resolve => {
    process.stdin.once('data', () => resolve());
  });

  // Step 3: Verify translations exist
  console.log('\n✅ Step 3: Verifying translations...');
  const esPath = path.join(PATHS.i18n, 'es', 'chapters', `${chNum}.json`);
  const ptPath = path.join(PATHS.i18n, 'pt', 'chapters', `${chNum}.json`);

  const esChapter = loadJSON(esPath);
  const ptChapter = loadJSON(ptPath);

  if (!esChapter || !ptChapter) {
    console.error('❌ Translations not found. Please create them first.');
    process.exit(1);
  }

  console.log(`   ✅ Spanish: "${esChapter.title}"`);
  console.log(`   ✅ Portuguese: "${ptChapter.title}"`);

  // Step 4: Update index.html navigation
  console.log('\n📄 Step 4: Updating navigation in index.html...');
  updateIndexNavigation(chNum, sourceChapter.title);

  // Step 5: Run build
  console.log('\n🔨 Step 5: Building site...');
  const buildResult = exec('npm run build', 'Running npm run build');
  if (!buildResult.success) {
    console.error('❌ Build failed');
    console.error(buildResult.error);
    process.exit(1);
  }
  console.log('   ✅ Build complete');

  // Step 5b: Generate PDFs
  console.log('\n📄 Step 5b: Generating PDFs...');
  const pdfResult = exec(`node scripts/build-pdf.js ${chNum}`, 'Generating chapter PDFs');
  if (pdfResult.success) {
    console.log('   ✅ PDFs generated for EN, ES, PT');
  } else {
    console.log('   ⚠️  PDF generation failed (non-critical)');
  }

  // Step 6: Git operations
  console.log('\n📦 Step 6: Git operations...');
  gitWorkflow(chNum, sourceChapter.title, esChapter.title, ptChapter.title);

  // Step 7: Update CONTEXT.md (NEW!)
  updateContextMd(chNum);

  // Step 8: Commit CONTEXT.md update
  console.log('\n📋 Step 8: Committing CONTEXT.md update...');
  exec('git add docs/CONTEXT.md', 'Staging CONTEXT.md');
  const contextCommitMsg = `docs: update CONTEXT.md - chapter ${parseInt(chNum)} published

Automated update after publishing chapter ${parseInt(chNum)}.
- Marked chapter as ✅ Published
- Updated chapter counter
- Updated timestamp

🤖 Generated with [Claude Code](https://claude.com/claude-code)`;

  fs.writeFileSync('/tmp/commit-msg-context.txt', contextCommitMsg);
  exec('git commit -F /tmp/commit-msg-context.txt', 'Creating CONTEXT.md commit');

  // Push if not skipped
  const skipPush = process.argv.includes('--no-push');
  if (!skipPush) {
    console.log('\n🚀 Pushing to remote...');
    const pushResult = exec('git push origin main', 'Pushing commits');
    if (pushResult.success) {
      console.log('   ✅ Pushed successfully');
    } else {
      console.log('   ⚠️  Push failed - run manually: git push origin main');
    }
  } else {
    console.log('\n   ℹ️  Skipped push (--no-push flag)');
    console.log('   Run manually: git push origin main');
  }

  console.log('\n✨ Translation workflow complete!\n');
  console.log('📊 Summary:');
  console.log(`   - Chapter ${chNum} translated to ES and PT`);
  console.log(`   - Navigation updated`);
  console.log(`   - Site rebuilt`);
  console.log(`   - PDFs generated (EN, ES, PT)`);
  console.log(`   - Git commits created`);
  console.log(`   - CONTEXT.md updated ✅`);
  console.log('\nNext steps:');
  console.log('   - Review the changes: git diff HEAD~3');
  if (skipPush) {
    console.log('   - Push to remote: git push origin main');
  }
}

// ============================================================================
// UPDATE NAVIGATION
// ============================================================================

function updateIndexNavigation(chNum, titleEn) {
  const chNumber = parseInt(chNum);

  // Update main index.html
  let indexHtml = fs.readFileSync(PATHS.indexHtml, 'utf8');

  // Check if chapter already exists in navigation
  const chapterLink = `<a href="#ch${chNumber}"`;
  if (indexHtml.includes(chapterLink)) {
    console.log('   ℹ️  Chapter already in navigation');
    return;
  }

  // Find the last chapter link and add new one
  const chapterRegex = /<a href="#ch(\d+)" class="nav-link"[^>]*>Ch \d+: [^<]+<\/a>/g;
  const matches = [...indexHtml.matchAll(chapterRegex)];

  if (matches.length === 0) {
    console.log('   ⚠️  Could not find chapter links pattern');
    return;
  }

  const lastMatch = matches[matches.length - 1];
  const lastChapterNum = parseInt(lastMatch[1]);

  if (chNumber <= lastChapterNum) {
    console.log('   ℹ️  Chapter number not sequential');
    return;
  }

  // Create short title for navigation
  const shortTitle = titleEn.length > 20 ? titleEn.substring(0, 20).trim() + '...' : titleEn;
  const newLink = `<a href="#ch${chNumber}" class="nav-link" style="margin-top:0.6rem">Ch ${chNumber}: ${shortTitle}</a>`;

  // Insert new link after the last chapter link
  const insertPos = lastMatch.index + lastMatch[0].length;
  indexHtml = indexHtml.substring(0, insertPos) + '\n                ' + newLink + indexHtml.substring(insertPos);

  // Update chapter counter
  indexHtml = indexHtml.replace(
    /Chapters 1–(\d+) of 16/,
    `Chapters 1–${chNumber} of 16`
  );

  fs.writeFileSync(PATHS.indexHtml, indexHtml);
  console.log('   ✅ Updated index.html');

  // Update es/index.html if it exists
  if (fs.existsSync(PATHS.esIndexHtml)) {
    updateEsNavigation(chNum, chNumber);
  }
}

function updateEsNavigation(chNum, chNumber) {
  const esChapter = loadJSON(path.join(PATHS.i18n, 'es', 'chapters', `${chNum}.json`));
  if (!esChapter) return;

  let esHtml = fs.readFileSync(PATHS.esIndexHtml, 'utf8');

  const chapterLink = `<a href="#capitulo-${chNumber}"`;
  if (esHtml.includes(chapterLink)) {
    console.log('   ℹ️  Chapter already in ES navigation');
    return;
  }

  const shortTitle = esChapter.title.length > 25 ? esChapter.title.substring(0, 25).trim() + '...' : esChapter.title;
  const newLink = `<a href="#capitulo-${chNumber}" class="nav-link" style="margin-top: 1rem;">Capítulo ${chNumber}: ${shortTitle}</a>`;

  // Find last chapter link and insert
  const chapterRegex = /<a href="#capitulo-(\d+)" class="nav-link"[^>]*>Capítulo \d+: [^<]+<\/a>/g;
  const matches = [...esHtml.matchAll(chapterRegex)];

  if (matches.length > 0) {
    const lastMatch = matches[matches.length - 1];
    const insertPos = lastMatch.index + lastMatch[0].length;
    esHtml = esHtml.substring(0, insertPos) + '\n            ' + newLink + esHtml.substring(insertPos);
  }

  // Update counter
  esHtml = esHtml.replace(
    /Capítulos 1–(\d+) de 16/,
    `Capítulos 1–${chNumber} de 16`
  );

  fs.writeFileSync(PATHS.esIndexHtml, esHtml);
  console.log('   ✅ Updated es/index.html');
}

// ============================================================================
// GIT WORKFLOW
// ============================================================================

function gitWorkflow(chNum, titleEn, titleEs, titlePt) {
  const chNumber = parseInt(chNum);

  // Add files
  exec('git add i18n/en/chapters/' + chNum + '.json i18n/es/chapters/' + chNum + '.json i18n/pt/chapters/' + chNum + '.json index.html', 'Staging chapter files');

  // Create commit for translations
  const commitMsg1 = `content: add chapter ${chNumber} (${titleEn}) in EN, ES, and PT

Added complete translation of Chapter ${chNumber}:
- EN: ${titleEn}
- ES: ${titleEs}
- PT: ${titlePt}

Translations maintain consistent terminology from the Law of One material.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>`;

  fs.writeFileSync('/tmp/commit-msg-1.txt', commitMsg1);
  exec('git commit -F /tmp/commit-msg-1.txt', 'Creating translation commit');

  // Create commit for site update
  const today = new Date().toISOString().split('T')[0];
  const time = new Date().toTimeString().split(' ')[0].substring(0, 5);
  const commitMsg2 = `content: update site ${today} ${time} [skip ci]

Update navigation index to include chapter ${chNumber}:
- Chapter ${chNumber}: ${titleEn}

Updated chapter counter to include chapter ${chNumber}

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>`;

  fs.writeFileSync('/tmp/commit-msg-2.txt', commitMsg2);
  exec('git add index.html', 'Staging index.html');
  exec('git commit -F /tmp/commit-msg-2.txt', 'Creating site update commit');

  // Note: Push is now handled after CONTEXT.md update in main workflow
}

// ============================================================================
// MAIN
// ============================================================================

const chapterNum = process.argv[2];

if (!chapterNum) {
  console.log('\n📖 Chapter Translation Automation Script\n');
  console.log('Usage:');
  console.log('  node scripts/translate-chapter.js <chapter-number>');
  console.log('  node scripts/translate-chapter.js 05 --no-push\n');
  console.log('Options:');
  console.log('  --no-push    Skip git push to remote\n');
  console.log('Features:');
  console.log('  - Generates translation prompts for ES and PT');
  console.log('  - Updates navigation in index.html');
  console.log('  - Rebuilds site with npm run build');
  console.log('  - Creates git commits');
  console.log('  - Updates CONTEXT.md (project status tracker) ✅\n');
  process.exit(0);
}

translateChapter(chapterNum).catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
