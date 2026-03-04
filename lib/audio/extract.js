/**
 * Extract chapter text from i18n JSON → TTS-ready plain text files
 *
 * Reads: i18n/{lang}/chapters/*.json
 * Writes: audiobook/text/{lang}/chNN.txt
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Load glossary for a language (returns {} if none)
 */
function loadGlossary(inputDir, lang) {
  const glossaryPath = join(inputDir, lang, 'glossary.json');
  try {
    return JSON.parse(readFileSync(glossaryPath, 'utf8'));
  } catch {
    return {};
  }
}

/**
 * Clean text for TTS narration:
 * - Replace {term:xxx} with glossary title
 * - Remove {ref:xxx} markers
 * - Fix duplicate articles (ES/EN/PT)
 */
export function cleanForTTS(text, glossary) {
  // {term:xxx} → glossary title, strip parenthetical descriptions
  text = text.replace(/\{term:([^}]+)\}/g, (_, id) => {
    const term = glossary[id];
    if (term && term.title) return term.title.replace(/\s*\([^)]+\)\s*/g, '').trim();
    return id.replace(/-/g, ' ');
  });

  // {ref:xxx} → remove entirely
  text = text.replace(/\{ref:[^}]+\}/g, '');

  // Fix duplicate articles from glossary term insertion
  const articlePattern = /\b(el|la|los|las|del|al|the|o|a|os|as|do|da|dos|das)\s+(el|la|los|las|the|o|a|os|as)\s/gi;
  text = text.replace(articlePattern, (match, art, termArt) => {
    const al = art.toLowerCase();
    const tl = termArt.toLowerCase();
    if (al === tl) return termArt + ' ';
    if ((al === 'del' || al === 'al') && tl === 'el') return art + ' ';
    if (al === 'do' && tl === 'os') return 'dos ';
    if (al === 'do' && tl === 'as') return 'das ';
    if (al === 'da' && tl === 'a') return 'da ';
    if (['do', 'da', 'dos', 'das'].includes(al) && ['o', 'a', 'os', 'as'].includes(tl)) return art + ' ';
    return match;
  });

  // Fix trailing duplicates from multi-word glossary terms
  text = text.replace(/((?:del|do|da|of|dos|das)\s+\w+)\s+\1/gi, '$1');

  // Clean double spaces
  text = text.replace(/  +/g, ' ');

  return text.trim();
}

/**
 * Convert chapter JSON to TTS-ready plain text
 */
function chapterToText(chapter, glossary) {
  const lines = [];

  lines.push(chapter.title);
  lines.push('');

  for (const section of chapter.sections) {
    lines.push(section.title);
    lines.push('');

    for (const block of section.content) {
      if (block.type === 'separator') {
        lines.push('');
        continue;
      }
      if ((block.type === 'paragraph' || block.type === 'quote' || block.type === 'blockquote') && block.text) {
        lines.push(cleanForTTS(block.text, glossary));
        lines.push('');
      }
    }
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Find chapter files dynamically (supports NN.json and chN.json patterns)
 */
function findChapterFiles(chaptersDir) {
  if (!existsSync(chaptersDir)) return [];
  return readdirSync(chaptersDir)
    .filter(f => f.match(/^(?:ch)?\d+\.json$/))
    .sort((a, b) => {
      const numA = parseInt(a.replace(/^ch/, ''));
      const numB = parseInt(b.replace(/^ch/, ''));
      return numA - numB;
    });
}

/**
 * Extract text for all chapters in specified languages
 */
export async function extract(config, options = {}) {
  const langs = options.lang ? [options.lang] : config.languages;
  const only = options.only || null;
  const audiobookDir = config.audiobook.audiobookDir;

  console.log('\n  EXTRACT TEXT FOR TTS\n');

  let totalFiles = 0;

  for (const lang of langs) {
    const chaptersDir = join(config.inputDir, lang, 'chapters');
    const files = findChapterFiles(chaptersDir);

    if (files.length === 0) {
      console.log(`  No chapters for ${lang}, skipping`);
      continue;
    }

    const glossary = loadGlossary(config.inputDir, lang);
    const outDir = join(audiobookDir, 'text', lang);
    mkdirSync(outDir, { recursive: true });

    console.log(`  ${lang.toUpperCase()} — ${files.length} chapters, ${Object.keys(glossary).length} glossary terms`);

    for (const file of files) {
      const num = parseInt(file.replace(/^ch/, ''));
      if (only && num !== only) continue;

      const chapter = JSON.parse(readFileSync(join(chaptersDir, file), 'utf8'));
      const text = chapterToText(chapter, glossary);
      const outPath = join(outDir, `ch${String(num).padStart(2, '0')}.txt`);

      writeFileSync(outPath, text, 'utf8');

      const wordCount = text.split(/\s+/).length;
      const estMin = Math.round(wordCount / 150);
      console.log(`    ch${String(num).padStart(2, '0')}.txt — ${wordCount.toLocaleString()} words (~${estMin} min)`);
      totalFiles++;
    }
  }

  console.log(`\n  ${totalFiles} text files extracted\n`);
}
