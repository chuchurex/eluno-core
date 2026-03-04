/**
 * Generate MP3 from text using Edge TTS (free, no API key)
 *
 * Reads: audiobook/text/{lang}/chNN.txt
 * Writes: audiobook/audio/{lang}/chNN.mp3
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';
import { createRequire } from 'module';

const MAX_CHUNK = 3000;

/**
 * Split text into TTS-friendly chunks at paragraph boundaries
 */
function splitIntoChunks(text) {
  const paragraphs = text.split('\n\n');
  const chunks = [];
  let current = '';

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    if ((current + '\n\n' + trimmed).length > MAX_CHUNK) {
      if (current) chunks.push(current.trim());
      current = trimmed;
    } else {
      current = current ? current + '\n\n' + trimmed : trimmed;
    }
  }

  if (current) chunks.push(current.trim());
  return chunks;
}

/**
 * Generate a single chapter MP3 from its text file
 */
async function generateChapter(EdgeTTS, textPath, outputPath, voice, rate, pitch) {
  const text = readFileSync(textPath, 'utf8');
  const chunks = splitIntoChunks(text);

  console.log(`    ${text.length.toLocaleString()} chars, ${chunks.length} chunks`);

  const tempFiles = [];

  for (let i = 0; i < chunks.length; i++) {
    process.stdout.write(`    Chunk ${i + 1}/${chunks.length}...`);

    const tempPath = outputPath.replace('.mp3', `.chunk${i}.mp3`);

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const tts = new EdgeTTS({
          voice,
          lang: voice.split('-').slice(0, 2).join('-'),
          outputFormat: 'audio-24khz-96kbitrate-mono-mp3',
          rate,
          pitch,
          timeout: 60000,
        });

        const start = Date.now();
        await tts.ttsPromise(chunks[i], tempPath);
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        const size = statSync(tempPath).size;
        console.log(` ok (${(size / 1024).toFixed(0)} KB, ${elapsed}s)`);

        tempFiles.push(tempPath);
        break;
      } catch (err) {
        if (attempt < 3) {
          process.stdout.write(` retry ${attempt + 1}/3...`);
          await new Promise(r => setTimeout(r, 2000 * attempt));
        } else {
          const msg = err?.message || String(err);
          console.log(` FAILED: ${msg}`);
          throw new Error(`Chunk ${i + 1} failed after 3 attempts: ${msg}`);
        }
      }
    }

    // Pause between chunks
    if (i < chunks.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // Concatenate all chunks
  const buffers = tempFiles.map(f => readFileSync(f));
  const combined = Buffer.concat(buffers);
  writeFileSync(outputPath, combined);

  // Cleanup temp files
  tempFiles.forEach(f => { try { unlinkSync(f); } catch {} });

  const sizeMB = (combined.length / 1024 / 1024).toFixed(2);
  console.log(`    Saved: ${sizeMB} MB`);

  return combined.length;
}

/**
 * Generate MP3s for all chapters in specified languages
 */
export async function generate(config, options = {}) {
  let EdgeTTS;
  try {
    // Resolve from consumer's project root (not core's location)
    // so peer deps are found even when core is npm-linked
    const req = createRequire(join(config.projectRoot, 'package.json'));
    EdgeTTS = req('node-edge-tts').EdgeTTS;
  } catch {
    console.error('Error: node-edge-tts not installed. Run: npm install node-edge-tts');
    process.exit(1);
  }

  const langs = options.lang ? [options.lang] : config.languages;
  const only = options.only || null;
  const voice = options.voice || null;
  const rate = options.rate || config.audiobook.rate;
  const pitch = options.pitch || config.audiobook.pitch;
  const force = options.force || false;
  const dryRun = options.dryRun || false;
  const audiobookDir = config.audiobook.audiobookDir;

  console.log('\n  EDGE TTS GENERATOR (free, no API key)\n');

  let totalSize = 0;
  let success = 0;
  const startTime = Date.now();

  for (const lang of langs) {
    const textDir = join(audiobookDir, 'text', lang);
    if (!existsSync(textDir)) {
      console.log(`  No text files for ${lang}. Run: eluno-audio extract --lang ${lang}`);
      continue;
    }

    const outDir = join(audiobookDir, 'audio', lang);
    mkdirSync(outDir, { recursive: true });

    const langVoice = voice || config.audiobook.voices[lang] || config.audiobook.voices.en;

    const files = readdirSync(textDir)
      .filter(f => f.match(/^ch\d{2}\.txt$/))
      .sort();

    console.log(`  ${lang.toUpperCase()} — Voice: ${langVoice} | Rate: ${rate} | Files: ${files.length}`);

    if (dryRun) console.log('  DRY RUN — no audio generated\n');

    for (const file of files) {
      const num = parseInt(file.replace('ch', '').replace('.txt', ''));
      if (only && num !== only) continue;

      const textPath = join(textDir, file);
      const outputPath = join(outDir, file.replace('.txt', '.mp3'));

      // Skip existing
      if (!force && existsSync(outputPath) && statSync(outputPath).size > 10000) {
        const sizeMB = (statSync(outputPath).size / 1024 / 1024).toFixed(1);
        console.log(`  ch${String(num).padStart(2, '0')} — skipped (${sizeMB} MB exists)`);
        continue;
      }

      console.log(`\n  ch${String(num).padStart(2, '0')}:`);

      if (dryRun) {
        const text = readFileSync(textPath, 'utf8');
        const chunks = splitIntoChunks(text);
        console.log(`    ${text.length.toLocaleString()} chars, ${chunks.length} chunks (~${Math.round(text.split(/\s+/).length / 150)} min)`);
        success++;
        continue;
      }

      try {
        const size = await generateChapter(EdgeTTS, textPath, outputPath, langVoice, rate, pitch);
        totalSize += size;
        success++;
      } catch (err) {
        console.error(`    Error: ${err.message}`);
        console.log('    Continuing...');
      }
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  console.log('\n  ' + '='.repeat(40));
  console.log(`  ${success} chapters processed`);
  if (!dryRun && totalSize > 0) {
    console.log(`  Total: ${(totalSize / 1024 / 1024).toFixed(2)} MB | Time: ${elapsed} min`);
  }
  console.log(`  Output: ${join(audiobookDir, 'audio')}\n`);
}
