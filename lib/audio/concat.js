/**
 * Concatenate individual chapter MP3s into a complete audiobook
 *
 * Reads: audiobook/audio/{lang}/ch01.mp3 ... chNN.mp3
 * Writes: audiobook/audio/{lang}/complete-book.mp3
 * Copies: dist/audiobook/{lang}/ (for web serving)
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, copyFileSync, statSync } from 'fs';
import { join, basename } from 'path';

function concatBuffers(inputFiles, outputPath) {
  const buffers = inputFiles.map(f => readFileSync(f));
  const combined = Buffer.concat(buffers);
  writeFileSync(outputPath, combined);
  return combined.length;
}

export async function concat(config, options = {}) {
  const langs = options.lang ? [options.lang] : config.languages;
  const noCopy = options.noCopy || false;
  const audiobookDir = config.audiobook.audiobookDir;

  console.log('\n  CONCATENATE AUDIOBOOK\n');

  for (const lang of langs) {
    const langDir = join(audiobookDir, 'audio', lang);
    if (!existsSync(langDir)) {
      console.log(`  No audio dir for ${lang}, skipping`);
      continue;
    }

    const files = readdirSync(langDir)
      .filter(f => f.match(/^ch\d{2}\.mp3$/))
      .sort()
      .map(f => join(langDir, f));

    if (files.length === 0) {
      console.log(`  No chapter MP3s for ${lang}`);
      continue;
    }

    console.log(`  ${lang.toUpperCase()} — ${files.length} chapters`);

    const outputPath = join(langDir, 'complete-book.mp3');
    const size = concatBuffers(files, outputPath);
    const sizeMB = (size / 1024 / 1024).toFixed(2);

    console.log(`    complete-book.mp3 — ${sizeMB} MB`);

    // Copy to dist for web serving
    if (!noCopy) {
      const distDir = join(config.outputDir, 'audiobook', lang);
      mkdirSync(distDir, { recursive: true });

      for (const file of files) {
        copyFileSync(file, join(distDir, basename(file)));
      }
      copyFileSync(outputPath, join(distDir, 'complete-book.mp3'));
      console.log(`    Copied to dist/audiobook/${lang}/`);
    }
  }

  console.log('\n  Done\n');
}
