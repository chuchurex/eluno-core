#!/usr/bin/env node

/**
 * Concat Audiobook Script
 *
 * Combines all chapter MP3s into a single audiobook file using FFmpeg.
 *
 * Usage:
 *   node scripts/concat-audiobook.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = process.cwd();
const AUDIO_DIR = path.join(PROJECT_ROOT, 'audiobook', 'audio', 'es');
const OUTPUT_FILE = path.join(AUDIO_DIR, 'ensenanzas-audiolibro-completo.mp3');

function main() {
  console.log('\n💿 Concatenando audiolibro completo...\n');

  // 1. Obtener archivos ordenados
  const files = fs.readdirSync(AUDIO_DIR)
    .filter(f => f.endsWith('.mp3'))
    .sort((a, b) => {
      const numA = parseInt(a.split('-')[0]);
      const numB = parseInt(b.split('-')[0]);
      return numA - numB;
    });

  if (files.length === 0) {
    console.error('❌ No se encontraron archivos MP3 en', AUDIO_DIR);
    process.exit(1);
  }

  console.log(`📂 Origen: ${AUDIO_DIR}`);
  console.log(`📝 Archivos encontrados: ${files.length}\n`);

  // 2. Crear lista para FFmpeg
  const listFile = path.join(AUDIO_DIR, 'concat-list.txt');
  const listContent = files.map(f => `file '${path.join(AUDIO_DIR, f)}'`).join('\n');
  fs.writeFileSync(listFile, listContent);

  // 3. Ejecutar FFmpeg
  console.log('🚀 Ejecutando FFmpeg...');

  // Asegurar directorio de salida
  const outDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  try {
    const cmd = `ffmpeg -y -f concat -safe 0 -i "${listFile}" -c copy "${OUTPUT_FILE}"`;
    execSync(cmd, { stdio: 'inherit' });

    console.log(`\n✅ Audiolibro creado exitosamente:`);
    console.log(`   ${OUTPUT_FILE}`);

    // Limpieza
    fs.unlinkSync(listFile);

  } catch (error) {
    console.error('\n❌ Error al ejecutar FFmpeg:', error.message);
    process.exit(1);
  }
}

main();
