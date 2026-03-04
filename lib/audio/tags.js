/**
 * Update ID3 tags on audiobook MP3 files
 *
 * Reads chapter titles from i18n JSON, applies tags to audiobook MP3s
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { createRequire } from 'module';

const GENRE = { es: 'Audiolibro', en: 'Audiobook', pt: 'Audiolivro' };
const LANG_CODE = { es: 'spa', en: 'eng', pt: 'por' };
const CH_PREFIX = { es: 'Cap.', en: 'Ch.', pt: 'Cap.' };

function loadTitles(inputDir, lang) {
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

function getChapterNum(filename) {
  const match = filename.match(/(\d{2})/);
  return match ? parseInt(match[1]) : null;
}

function isCompleteBook(filename) {
  const lower = filename.toLowerCase();
  return lower.includes('completo') || lower.includes('complete') || lower.includes('full');
}

function isChapterFile(filename) {
  return /^ch\d{2}\.mp3$/.test(filename)
    || /^\d{2}-/.test(filename)
    || /-(cap|ch)-\d{2}-/.test(filename);
}

export async function tag(config, options = {}) {
  let NodeID3;
  try {
    const req = createRequire(join(config.projectRoot, 'package.json'));
    NodeID3 = req('node-id3');
  } catch {
    console.error('Error: node-id3 not installed. Run: npm install node-id3');
    process.exit(1);
  }

  const langs = options.lang ? [options.lang] : config.languages;
  const audiobookDir = config.audiobook.audiobookDir;
  const bookTitles = config.audiobook.bookNames;
  const tagsConfig = config.audiobook.tags;

  console.log('\n  UPDATE ID3 TAGS\n');

  for (const lang of langs) {
    const dirs = [
      join(audiobookDir, 'audio', lang),
      join(audiobookDir, 'final', lang),
    ].filter(d => existsSync(d));

    if (dirs.length === 0) {
      console.log(`  No audio files for ${lang}`);
      continue;
    }

    const bookTitle = bookTitles[lang] || bookTitles[config.baseLang] || 'Book';
    const titles = loadTitles(config.inputDir, lang);
    const totalChapters = Object.keys(titles).length;
    const genre = GENRE[lang] || 'Audiobook';
    const langCode = LANG_CODE[lang] || 'eng';
    const chPrefix = CH_PREFIX[lang] || 'Ch.';

    console.log(`  ${lang.toUpperCase()} — ${bookTitle} (${totalChapters} chapters)`);

    let updated = 0;

    for (const dir of dirs) {
      const files = readdirSync(dir).filter(f => f.endsWith('.mp3')).sort();

      for (const file of files) {
        const filePath = join(dir, file);

        const tags = {
          artist: tagsConfig.artist,
          album: bookTitle,
          year: tagsConfig.year,
          genre,
          publisher: tagsConfig.artist,
        };

        if (tagsConfig.attribution?.[lang]) {
          tags.comment = { language: langCode, text: tagsConfig.attribution[lang] };
        }

        if (isCompleteBook(file)) {
          tags.title = bookTitle;
        } else if (isChapterFile(file)) {
          const num = getChapterNum(file);
          if (num && titles[num]) {
            tags.title = `${bookTitle} - ${chPrefix}${num}: ${titles[num]}`;
            tags.trackNumber = `${num}/${totalChapters}`;
          } else {
            continue;
          }
        } else {
          continue;
        }

        const success = NodeID3.update(tags, filePath);
        if (success) {
          console.log(`    ok  ${file}`);
          updated++;
        } else {
          console.log(`    ERR ${file}`);
        }
      }
    }

    console.log(`    ${updated} files tagged`);
  }

  console.log('\n  Done\n');
}
