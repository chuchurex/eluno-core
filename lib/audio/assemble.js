/**
 * Assemble final MP3s with intro + content + outro via ffmpeg
 *
 * Structure per chapter:
 *   [chapter content] + [2s silence] + [outro clip]
 *
 * Structure for complete book:
 *   [intro clip] + [3s silence] + [all assembled chapters]
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { createRequire } from 'module';

function slugify(text) {
  return text.toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function loadChapterTitles(inputDir, lang) {
  const dir = join(inputDir, lang, 'chapters');
  const titles = {};
  if (!existsSync(dir)) return titles;
  for (const file of readdirSync(dir).filter(f => f.match(/^(?:ch)?\d+\.json$/))) {
    try {
      const data = JSON.parse(readFileSync(join(dir, file), 'utf8'));
      const num = parseInt(file.replace(/^ch/, ''));
      if (!isNaN(num) && data.title) titles[num] = data.title;
    } catch {}
  }
  return titles;
}

function generateSilence(outputPath, durationSec) {
  execSync(`ffmpeg -f lavfi -i anullsrc=r=24000:cl=mono -t ${durationSec} -c:a libmp3lame -b:a 96k -y "${outputPath}" 2>/dev/null`);
}

function concatMp3s(files, outputPath) {
  const listPath = outputPath + '.list';
  const listContent = files.map(f => `file '${f}'`).join('\n');
  writeFileSync(listPath, listContent);
  execSync(`ffmpeg -f concat -safe 0 -i "${listPath}" -c copy -y "${outputPath}" 2>/dev/null`);
  unlinkSync(listPath);
}

async function generateClip(EdgeTTS, text, voice, outputPath, rate = '-5%') {
  const tts = new EdgeTTS({
    voice,
    lang: voice.split('-').slice(0, 2).join('-'),
    outputFormat: 'audio-24khz-96kbitrate-mono-mp3',
    rate,
    pitch: '+0Hz',
    timeout: 60000,
  });
  await tts.ttsPromise(text, outputPath);
}

/**
 * Chapter label per language (for file prefixes)
 */
const CH_LABELS = { es: 'cap', en: 'ch', pt: 'cap' };

/**
 * "Complete audiobook" label per language
 */
const COMPLETE_LABELS = {
  es: 'audiolibro-completo',
  en: 'complete-audiobook',
  pt: 'audiolivro-completo',
};

export async function assemble(config, options = {}) {
  let EdgeTTS;
  try {
    const req = createRequire(join(config.projectRoot, 'package.json'));
    EdgeTTS = req('node-edge-tts').EdgeTTS;
  } catch {
    console.error('Error: node-edge-tts not installed. Run: npm install node-edge-tts');
    process.exit(1);
  }

  const langs = options.lang ? [options.lang] : config.languages;
  const only = options.only || null;
  const audiobookDir = config.audiobook.audiobookDir;
  const bookNames = config.audiobook.bookNames;

  console.log('\n  ASSEMBLE CHAPTERS WITH INTRO + OUTRO\n');

  // Shared silence clips
  const clipsDir = join(audiobookDir, 'clips');
  mkdirSync(clipsDir, { recursive: true });

  const silence2 = join(clipsDir, 'silence-2s.mp3');
  const silence3 = join(clipsDir, 'silence-3s.mp3');

  if (!existsSync(silence2)) {
    process.stdout.write('  Generating silence clips...');
    generateSilence(silence2, 2);
    generateSilence(silence3, 3);
    console.log(' ok');
  }

  for (const lang of langs) {
    const bookName = bookNames[lang] || bookNames[config.baseLang] || 'Book';
    const bookSlug = slugify(bookName);
    const chLabel = CH_LABELS[lang] || 'ch';

    console.log(`\n  ${lang.toUpperCase()} — ${bookName}\n`);

    const titles = loadChapterTitles(config.inputDir, lang);
    const voice = config.audiobook.voices[lang] || config.audiobook.voices.en;
    const langClipsDir = join(clipsDir, lang);
    const langFinalDir = join(audiobookDir, 'final', lang);
    mkdirSync(langClipsDir, { recursive: true });
    mkdirSync(langFinalDir, { recursive: true });

    // Generate outro clip if text provided
    const outroPath = join(langClipsDir, 'outro.mp3');
    if (!existsSync(outroPath) && config.audiobook.outro?.[lang]) {
      process.stdout.write(`  Generating outro clip...`);
      await generateClip(EdgeTTS, config.audiobook.outro[lang], voice, outroPath);
      console.log(' ok');
      await new Promise(r => setTimeout(r, 1500));
    }

    // Generate complete book intro clip if tagline provided
    const completeIntroPath = join(langClipsDir, 'intro-complete.mp3');
    if (!existsSync(completeIntroPath) && config.audiobook.tagline?.[lang]) {
      const introText = `${bookName}. ${config.audiobook.tagline[lang]}`;
      process.stdout.write(`  Generating book intro...`);
      await generateClip(EdgeTTS, introText, voice, completeIntroPath, '-10%');
      console.log(' ok');
      await new Promise(r => setTimeout(r, 1500));
    }

    // Find available audio files
    const audioDir = join(audiobookDir, 'audio', lang);
    if (!existsSync(audioDir)) {
      console.log(`  No audio files for ${lang}. Run: eluno-audio generate --lang ${lang}`);
      continue;
    }

    const assembledChapters = [];
    const chapterNums = Object.keys(titles).map(Number).sort((a, b) => a - b);

    for (const num of chapterNums) {
      if (only && num !== only) continue;

      const title = titles[num];
      const padded = String(num).padStart(2, '0');
      const slug = slugify(title);
      const seoName = `${bookSlug}-${chLabel}-${padded}-${slug}`;

      // Find source MP3
      let srcMp3 = join(audioDir, `${seoName}.mp3`);
      if (!existsSync(srcMp3)) {
        srcMp3 = join(audioDir, `ch${padded}.mp3`);
        if (!existsSync(srcMp3)) {
          console.log(`  No audio for ch${padded}, skipping`);
          continue;
        }
      }

      const finalPath = join(langFinalDir, `${seoName}.mp3`);

      // Assemble: content + [silence + outro if available]
      const parts = [srcMp3];
      if (existsSync(outroPath)) {
        parts.push(silence2, outroPath);
      }

      process.stdout.write(`  ${seoName}...`);
      concatMp3s(parts, finalPath);
      const sizeMB = (statSync(finalPath).size / 1024 / 1024).toFixed(1);
      console.log(` ok (${sizeMB} MB)`);

      assembledChapters.push(finalPath);
    }

    // Assemble complete book if all chapters present and not filtering
    if (!only && assembledChapters.length === chapterNums.length && assembledChapters.length > 0) {
      const completeLabel = COMPLETE_LABELS[lang] || 'complete-audiobook';
      const completeName = `${bookSlug}-${completeLabel}.mp3`;
      const completePath = join(langFinalDir, completeName);

      process.stdout.write(`\n  ${completeName}...`);
      const allParts = [];
      if (existsSync(completeIntroPath)) allParts.push(completeIntroPath, silence3);
      allParts.push(...assembledChapters);
      concatMp3s(allParts, completePath);
      const sizeMB = (statSync(completePath).size / 1024 / 1024).toFixed(1);
      console.log(` ok (${sizeMB} MB)`);
    }

    console.log(`\n  Output: ${langFinalDir}`);
  }

  console.log('\n  Done\n');
}
