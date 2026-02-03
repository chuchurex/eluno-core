#!/usr/bin/env node

/**
 * Translate "Las Enseñanzas de la Ley del Uno" from Spanish to Portuguese
 * Using Anthropic Claude API
 * 
 * Usage:
 *   node packages/core/scripts/translate-to-pt.js chapter 01    # Translate specific chapter
 *   node packages/core/scripts/translate-to-pt.js file ui       # Translate ui.json
 *   node packages/core/scripts/translate-to-pt.js all           # Translate everything
 *   node packages/core/scripts/translate-to-pt.js chapters      # Translate all chapters only
 * 
 * Environment:
 *   ANTHROPIC_API_KEY - Required in root .env file
 */

const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

// Load .env from project root
const PROJECT_ROOT = process.cwd();
require('dotenv').config({ path: path.join(PROJECT_ROOT, '.env') });

// ============================================================================
// CONFIGURATION
// ============================================================================

const I18N_ES = path.join(PROJECT_ROOT, 'i18n', 'es');
const I18N_PT = path.join(PROJECT_ROOT, 'i18n', 'pt');

// Law of One terminology ES → PT (from CONTEXT.md glossary)
const GLOSSARY = {
  'Cosecha': 'Colheita',
  'Distorsión': 'Distorção',
  'Catalizador': 'Catalisador',
  'Densidad': 'Densidade',
  'Densidades': 'Densidades',
  'Servicio a Otros': 'Serviço aos Outros',
  'Servicio a Sí Mismo': 'Serviço a Si Mesmo',
  'Libre Albedrío': 'Livre Arbítrio',
  'El Velo': 'O Véu',
  'Velo': 'Véu',
  'Logos': 'Logos',
  'Infinito Inteligente': 'Infinito Inteligente',
  'Infinito': 'Infinito',
  'Creador Infinito': 'Criador Infinito',
  'Complejo de Memoria Social': 'Complexo de Memória Social',
  'Complejo Mente/Cuerpo/Espíritu': 'Complexo Mente/Corpo/Espírito',
  'Errante': 'Andarilho',
  'Errantes': 'Andarilhos',
  'Confederación': 'Confederação',
  'Grupo de Orión': 'Grupo de Órion',
  'El Uno': 'O Um',
  'La Ley del Uno': 'A Lei do Um',
  'Las Enseñanzas': 'Os Ensinamentos',
  'chakra': 'chakra',
  'chakras': 'chakras',
  'karma': 'karma',
  'encarnación': 'encarnação',
  'reencarnación': 'reencarnação',
  'despertar': 'despertar',
  'iluminación': 'iluminação',
  'meditación': 'meditação',
  'consciencia': 'consciência',
  'Yo Superior': 'Eu Superior',
  'Guía Interior': 'Guia Interior'
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`   📁 Created directory: ${path.relative(PROJECT_DIR, dir)}`);
  }
}

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
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    return true;
  } catch (e) {
    console.error(`❌ Error saving ${filePath}: ${e.message}`);
    return false;
  }
}

function getGlossaryPrompt() {
  return Object.entries(GLOSSARY)
    .map(([es, pt]) => `- ${es} → ${pt}`)
    .join('\n');
}

// ============================================================================
// TRANSLATION FUNCTIONS
// ============================================================================

async function translateWithClaude(client, content, fileType = 'chapter') {
  const contentStr = JSON.stringify(content, null, 2);

  const contextByType = {
    chapter: 'un capítulo de libro espiritual/filosófico sobre La Ley del Uno',
    ui: 'la interfaz de usuario de un sitio web espiritual',
    about: 'la página "Acerca de" de un proyecto espiritual',
    media: 'configuración de medios (audio/video) de un sitio web'
  };

  const prompt = `Eres un traductor profesional especializándote en textos espirituales y filosóficos. Traduce el siguiente JSON de español a portugués brasileño.

CONTEXTO: Este es ${contextByType[fileType] || 'contenido de un sitio espiritual'}.

GLOSARIO - Usa SIEMPRE estas traducciones exactas para mantener consistencia:
${getGlossaryPrompt()}

REGLAS DE TRADUCCIÓN:
1. Traduce TODO el texto en español a portugués brasileño
2. Mantén la estructura JSON EXACTAMENTE igual
3. NO traduzcas:
   - Campos "id", "number", "type"
   - URLs y enlaces
   - Nombres propios de personas (Carlos Martínez, etc.)
   - Etiquetas HTML (<a>, <em>, etc.) pero SÍ traduce el texto dentro
   - Marcadores {term:...} - mantén el ID sin traducir
4. USA tratamiento formal (você/vocês) y tono reverente, contemplativo
5. Mantén la poesía y profundidad filosófica del original
6. Para "numberText" usa: "Capítulo Um", "Capítulo Dois", etc.

JSON A TRADUCIR:

\`\`\`json
${contentStr}
\`\`\`

Responde ÚNICAMENTE con el JSON traducido, sin explicaciones ni texto adicional.`;

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const responseText = message.content[0].text;

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No se encontró JSON válido en la respuesta');
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    if (error.message.includes('No se encontró JSON')) {
      throw error;
    }
    throw new Error(`API Error: ${error.message}`);
  }
}

async function translateChapter(client, chapterNum) {
  const num = String(chapterNum).padStart(2, '0');
  const esPath = path.join(I18N_ES, 'chapters', `${num}.json`);
  const ptPath = path.join(I18N_PT, 'chapters', `${num}.json`);

  // Check if ES source exists
  if (!fs.existsSync(esPath)) {
    console.log(`   ⚠️  Chapter ${num} not found in ES`);
    return null;
  }

  const esChapter = loadJSON(esPath);
  if (!esChapter) return null;

  console.log(`\n📖 Translating Chapter ${num}: "${esChapter.title}"`);

  try {
    const ptChapter = await translateWithClaude(client, esChapter, 'chapter');

    // Ensure chapters directory exists
    ensureDir(path.join(I18N_PT, 'chapters'));

    // Save translation
    if (saveJSON(ptPath, ptChapter)) {
      console.log(`   ✅ Saved: i18n/pt/chapters/${num}.json`);
      console.log(`   📝 Title PT: "${ptChapter.title}"`);
      return ptChapter;
    }
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return null;
  }
}

async function translateFile(client, fileName) {
  const esPath = path.join(I18N_ES, `${fileName}.json`);
  const ptPath = path.join(I18N_PT, `${fileName}.json`);

  if (!fs.existsSync(esPath)) {
    console.log(`   ⚠️  File ${fileName}.json not found in ES`);
    return null;
  }

  const esContent = loadJSON(esPath);
  if (!esContent) return null;

  // Special case: empty files
  if (Object.keys(esContent).length === 0 ||
    (typeof esContent === 'object' && JSON.stringify(esContent) === '{}') ||
    (typeof esContent === 'object' && JSON.stringify(esContent) === '[]')) {
    console.log(`\n📄 Copying empty file: ${fileName}.json`);
    ensureDir(I18N_PT);
    saveJSON(ptPath, esContent);
    console.log(`   ✅ Saved: i18n/pt/${fileName}.json`);
    return esContent;
  }

  console.log(`\n📄 Translating: ${fileName}.json`);

  try {
    const ptContent = await translateWithClaude(client, esContent, fileName);

    ensureDir(I18N_PT);

    if (saveJSON(ptPath, ptContent)) {
      console.log(`   ✅ Saved: i18n/pt/${fileName}.json`);
      return ptContent;
    }
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return null;
  }
}

// ============================================================================
// MAIN COMMANDS
// ============================================================================

async function translateAllChapters(client) {
  console.log('\n🌍 Translating all chapters ES → PT...\n');

  // Get list of chapters from ES
  const chaptersDir = path.join(I18N_ES, 'chapters');
  const files = fs.readdirSync(chaptersDir).filter(f => f.endsWith('.json'));

  console.log(`   Found ${files.length} chapters to translate\n`);

  let success = 0;
  let failed = 0;

  for (const file of files) {
    const num = file.replace('.json', '');
    const result = await translateChapter(client, num);

    if (result) {
      success++;
    } else {
      failed++;
    }

    // Delay between API calls to avoid rate limits
    if (files.indexOf(file) < files.length - 1) {
      console.log('   ⏳ Waiting 2s before next chapter...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log(`\n✨ Chapters translated: ${success}/${files.length}`);
  if (failed > 0) {
    console.log(`   ⚠️  Failed: ${failed}`);
  }
}

async function translateAllFiles(client) {
  console.log('\n🌍 Translating UI files ES → PT...\n');

  const files = ['ui', 'about', 'media', 'glossary', 'references'];

  for (const file of files) {
    await translateFile(client, file);

    // Small delay
    if (files.indexOf(file) < files.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

async function translateAll(client) {
  console.log('\n' + '═'.repeat(60));
  console.log('  🌍 TRANSLATING ALL CONTENT: ES → PT');
  console.log('═'.repeat(60));

  // First, UI files
  await translateAllFiles(client);

  // Then, chapters
  await translateAllChapters(client);

  console.log('\n' + '═'.repeat(60));
  console.log('  ✅ TRANSLATION COMPLETE');
  console.log('═'.repeat(60));
  console.log('\nNext steps:');
  console.log('   1. Update packages/todo/.env: LANGUAGES=en,es,pt');
  console.log('   2. Run: cd packages/todo && npm run build');
  console.log('   3. Verify: npm run dev:todo and visit /pt/');
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
📖 Law of One Translation Script (ES → PT)

Usage:
  node translate-to-pt.js chapter <number>   Translate specific chapter (01-11)
  node translate-to-pt.js file <name>        Translate specific file (ui, about, media)
  node translate-to-pt.js chapters           Translate all chapters
  node translate-to-pt.js files              Translate all UI files  
  node translate-to-pt.js all                Translate everything

Environment:
  ANTHROPIC_API_KEY must be set in root .env file

Examples:
  node translate-to-pt.js chapter 01
  node translate-to-pt.js file ui
  node translate-to-pt.js all
`);
    process.exit(0);
  }

  // Check for API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('❌ ANTHROPIC_API_KEY not found in environment');
    console.error('   Add it to the root .env file:');
    console.error('   ANTHROPIC_API_KEY=sk-ant-xxxxx');
    process.exit(1);
  }

  console.log('🔑 Anthropic API key found');

  const client = new Anthropic({ apiKey });

  const command = args[0];
  const value = args[1];

  switch (command) {
    case 'chapter':
      if (!value) {
        console.error('❌ Please specify chapter number: translate-to-pt.js chapter 01');
        process.exit(1);
      }
      await translateChapter(client, value);
      break;

    case 'file':
      if (!value) {
        console.error('❌ Please specify file name: translate-to-pt.js file ui');
        process.exit(1);
      }
      await translateFile(client, value);
      break;

    case 'chapters':
      await translateAllChapters(client);
      break;

    case 'files':
      await translateAllFiles(client);
      break;

    case 'all':
      await translateAll(client);
      break;

    default:
      console.error(`❌ Unknown command: ${command}`);
      console.error('   Use: chapter, file, chapters, files, or all');
      process.exit(1);
  }
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
