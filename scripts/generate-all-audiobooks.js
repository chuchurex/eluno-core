#!/usr/bin/env node

/**
 * Batch Audiobook Generator
 *
 * Generates all audiobook chapters using Fish Audio TTS
 * Uses the TTS-optimized markdown files (with numbers converted to text)
 *
 * Usage:
 *   node scripts/generate-all-audiobooks.js
 *   node scripts/generate-all-audiobooks.js --start 5      # Start from chapter 5
 *   node scripts/generate-all-audiobooks.js --only 3       # Only chapter 3
 *   node scripts/generate-all-audiobooks.js --dry-run      # Preview without generating
 *
 * Output:
 *   audiobook/audio/es/01-cosmologia-y-genesis.mp3
 *   audiobook/audio/es/02-el-creador-y-la-creacion.mp3
 *   ...
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// ============================================================================
// LOAD .ENV
// ============================================================================

const PROJECT_ROOT = process.cwd();
const envPath = path.join(PROJECT_ROOT, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const INPUT_DIR = path.join(PROJECT_ROOT, 'audiobook', 'content', 'es');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'audiobook', 'audio', 'es');

// ============================================================================
// PARSE ARGUMENTS
// ============================================================================

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    start: 1,
    only: null,
    dryRun: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--start':
        options.start = parseInt(args[++i]);
        break;
      case '--only':
        options.only = parseInt(args[++i]);
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
    }
  }

  return options;
}

function showHelp() {
  console.log(`
🎙️  Batch Audiobook Generator

Uso:
  node scripts/generate-all-audiobooks.js [opciones]

Opciones:
  --start <n>    Comenzar desde el capitulo n (default: 1)
  --only <n>     Solo generar capitulo n
  --dry-run      Vista previa sin generar audio
  --help, -h     Mostrar esta ayuda

Ejemplos:
  node scripts/generate-all-audiobooks.js              # Todos los capitulos
  node scripts/generate-all-audiobooks.js --start 5    # Desde capitulo 5
  node scripts/generate-all-audiobooks.js --only 3     # Solo capitulo 3
  node scripts/generate-all-audiobooks.js --dry-run    # Vista previa
`);
}

// ============================================================================
// MARKDOWN TO TEXT
// ============================================================================

function markdownToPlainText(markdown) {
  let text = markdown;

  // Convertir headers a pausas naturales
  text = text.replace(/^### (.+)$/gm, '\n\n$1.\n\n');
  text = text.replace(/^## (.+)$/gm, '\n\n$1.\n\n');
  text = text.replace(/^# (.+)$/gm, '\n\n$1.\n\n');

  // Remover lineas horizontales
  text = text.replace(/^---+$/gm, '\n');

  // Remover marcadores de fin de capitulo
  text = text.replace(/\*Fin del Capitulo.*\*/gi, '');

  // Limpiar espacios multiples
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.trim();

  return text;
}

// ============================================================================
// SPLIT TEXT INTO CHUNKS
// ============================================================================

function splitIntoChunks(text, maxChunkSize = 4000) {
  const paragraphs = text.split('\n\n');
  const chunks = [];
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;

    if ((currentChunk + '\n\n' + trimmed).length > maxChunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = trimmed;
    } else {
      currentChunk = currentChunk ? currentChunk + '\n\n' + trimmed : trimmed;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

// ============================================================================
// FISH AUDIO API
// ============================================================================

async function generateAudioChunk(text, voiceId, apiKey) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      text: text,
      reference_id: voiceId,
      format: 'mp3',
      normalize: true,
      latency: 'normal'
    });

    const options = {
      hostname: 'api.fish.audio',
      port: 443,
      path: '/v1/tts',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      const chunks = [];

      res.on('data', (chunk) => chunks.push(chunk));

      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(Buffer.concat(chunks));
        } else {
          reject(new Error(`API error ${res.statusCode}: ${Buffer.concat(chunks).toString()}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// ============================================================================
// GENERATE SINGLE CHAPTER
// ============================================================================

async function generateChapter(inputFile, outputFile, voiceId, apiKey, dryRun) {
  const markdown = fs.readFileSync(inputFile, 'utf8');
  const plainText = markdownToPlainText(markdown);
  const chunks = splitIntoChunks(plainText);

  console.log(`   📄 ${plainText.length.toLocaleString()} caracteres, ${chunks.length} chunks`);

  if (dryRun) {
    console.log(`   🔍 [DRY RUN] Se generarian ${chunks.length} chunks de audio`);
    return { success: true, dryRun: true };
  }

  const audioChunks = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    process.stdout.write(`   🔊 Chunk ${i + 1}/${chunks.length}...`);

    try {
      const audioBuffer = await generateAudioChunk(chunk, voiceId, apiKey);
      audioChunks.push(audioBuffer);
      console.log(` ✅ (${(audioBuffer.length / 1024).toFixed(0)} KB)`);

      // Rate limiting
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.log(` ❌`);
      throw error;
    }
  }

  // Combine and save
  const combinedBuffer = Buffer.concat(audioChunks);
  fs.writeFileSync(outputFile, combinedBuffer);

  const sizeMB = (combinedBuffer.length / 1024 / 1024).toFixed(2);
  console.log(`   💾 Guardado: ${sizeMB} MB`);

  return { success: true, size: combinedBuffer.length };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const options = parseArgs();

  console.log('\n🎙️  BATCH AUDIOBOOK GENERATOR\n');

  // Validaciones
  const apiKey = process.env.FISH_API_KEY;
  const voiceId = process.env.FISH_VOICE_ID;

  if (!apiKey) {
    console.error('❌ Error: FISH_API_KEY no configurado en .env');
    process.exit(1);
  }

  if (!voiceId) {
    console.error('❌ Error: FISH_VOICE_ID no configurado en .env');
    process.exit(1);
  }

  // Verificar directorio de entrada
  if (!fs.existsSync(INPUT_DIR)) {
    console.error(`❌ Error: Directorio TTS no encontrado: ${INPUT_DIR}`);
    console.log('\n💡 Ejecuta primero: node scripts/build-audiobook-tts.js\n');
    process.exit(1);
  }

  // Crear directorio de salida
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Obtener lista de archivos
  const files = fs.readdirSync(INPUT_DIR)
    .filter(f => f.match(/^\d{2}-.*\.md$/))
    .sort();

  if (files.length === 0) {
    console.error('❌ No se encontraron archivos de capitulos');
    process.exit(1);
  }

  console.log(`📂 Entrada: ${INPUT_DIR}`);
  console.log(`📂 Salida: ${OUTPUT_DIR}`);
  console.log(`🎤 Voz: ${voiceId}`);
  console.log(`📚 Capitulos disponibles: ${files.length}`);

  if (options.dryRun) {
    console.log('\n⚠️  MODO DRY RUN - No se generara audio\n');
  }

  // Filtrar capitulos segun opciones
  let filesToProcess = files;

  if (options.only) {
    filesToProcess = files.filter(f => {
      const num = parseInt(f.split('-')[0]);
      return num === options.only;
    });
    if (filesToProcess.length === 0) {
      console.error(`❌ Capitulo ${options.only} no encontrado`);
      process.exit(1);
    }
  } else if (options.start > 1) {
    filesToProcess = files.filter(f => {
      const num = parseInt(f.split('-')[0]);
      return num >= options.start;
    });
  }

  console.log(`\n🎯 Capitulos a procesar: ${filesToProcess.length}\n`);

  // Procesar cada capitulo
  let successCount = 0;
  let totalSize = 0;
  const startTime = Date.now();

  for (let i = 0; i < filesToProcess.length; i++) {
    const file = filesToProcess[i];
    const chapterNum = file.split('-')[0];
    const inputPath = path.join(INPUT_DIR, file);
    const outputPath = path.join(OUTPUT_DIR, file.replace('.md', '.mp3'));

    console.log(`\n📖 Capitulo ${chapterNum} (${i + 1}/${filesToProcess.length}): ${file}`);

    try {
      const result = await generateChapter(inputPath, outputPath, voiceId, apiKey, options.dryRun);
      successCount++;
      if (result.size) {
        totalSize += result.size;
      }
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      console.log('\n⚠️  Continuando con el siguiente capitulo...\n');
    }

    // Pausa entre capitulos para evitar rate limiting
    if (i < filesToProcess.length - 1 && !options.dryRun) {
      console.log('   ⏳ Esperando 2s antes del siguiente capitulo...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Resumen final
  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  console.log('\n' + '='.repeat(60));
  console.log('✨ COMPLETADO\n');
  console.log('📊 Resumen:');
  console.log(`   Capitulos procesados: ${successCount}/${filesToProcess.length}`);
  if (!options.dryRun) {
    console.log(`   Tamano total: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Tiempo: ${elapsed} minutos`);
    console.log(`\n📁 Audios guardados en: ${OUTPUT_DIR}\n`);
  }
}

main().catch(err => {
  console.error('\n❌ Error fatal:', err.message);
  process.exit(1);
});
