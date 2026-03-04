/**
 * Build orchestrator — main entry point for @eluno/core v2
 */

import { writeFileSync } from 'fs';
import { join } from 'path';
import { resolveConfig } from '../config.js';
import {
  loadChapters,
  loadGlossary,
  loadGlossaryMeta,
  loadReferences,
  loadMedia,
  loadProvenance,
  loadAbout
} from './chapters.js';
import { buildChapterSlugMap, langPrefix } from './navigation.js';
import {
  generateChapterHtml,
  generateIndexHtml,
  generateAboutHtml,
  generateGlossaryHtml
} from './html.js';
import { generateSearchIndex } from './search.js';
import { generateSitemap, generateRobotsTxt } from './sitemap.js';
import { ensureDir, copyJsFiles, copyFonts, generateRootIndex, copyStaticFiles } from './assets.js';
import { slugify } from './content.js';

/**
 * Build a single language.
 */
function buildLanguage(config, lang, chapterSlugMap, glossaryMeta) {
  console.log(`\n📖 Building ${lang.toUpperCase()}...`);

  const chapters = loadChapters(config, lang);
  const glossary = loadGlossary(config, lang);
  const references = loadReferences(config, lang);
  const media = loadMedia(config, lang);

  console.log(`  Found ${chapters.length} chapters`);
  console.log(`  Found ${Object.keys(glossary).length} glossary terms`);
  console.log(`  Media: ${media ? 'found' : 'none'}`);

  // Create output directories
  const lp = langPrefix(config, lang);
  const langDir = lp ? join(config.outputDir, lang) : config.outputDir;

  if (config.chapterUrlPattern === 'numeric') {
    // For numeric: /{lang}/ch{N}/index.html or /ch{N}/index.html (base lang no prefix)
    ensureDir(langDir);
  } else {
    // For slug: /{lang}/chapters/{slug}.html
    ensureDir(join(langDir, 'chapters'));
  }

  // Build each chapter
  chapters.forEach(chapter => {
    const provenance = loadProvenance(config, chapter.number);
    const html = generateChapterHtml(
      config, chapter, lang, glossary, references,
      provenance, chapters, chapterSlugMap, media
    );

    let outputPath;
    if (config.chapterUrlPattern === 'numeric') {
      const chDir = join(langDir, `ch${chapter.number}`);
      ensureDir(chDir);
      outputPath = join(chDir, 'index.html');
    } else {
      const slug = slugify(chapter.title);
      outputPath = join(langDir, 'chapters', `${slug}.html`);
    }

    writeFileSync(outputPath, html);
    const provenanceStatus = provenance ? '✓' : '○';
    const label = config.chapterUrlPattern === 'numeric'
      ? `ch${chapter.number}/index.html`
      : `${slugify(chapter.title)}.html`;
    console.log(`  ${provenanceStatus} Chapter ${chapter.number}: ${label}`);
  });

  // Build index page
  const indexHtml = generateIndexHtml(config, lang, chapters, media);
  writeFileSync(join(langDir, 'index.html'), indexHtml);
  console.log(`  ✓ index.html`);

  // Build about page
  const about = loadAbout(config, lang);
  if (about) {
    const aboutHtml = generateAboutHtml(config, lang, about, chapters, chapterSlugMap);
    writeFileSync(join(langDir, 'about.html'), aboutHtml);
    console.log(`  ✓ about.html`);
  }

  // Build glossary page (only if glossary feature enabled)
  if (config.features.glossary) {
    const glossaryHtml = generateGlossaryHtml(config, lang, glossary, glossaryMeta, chapters, chapterSlugMap);
    writeFileSync(join(langDir, 'glossary.html'), glossaryHtml);
    console.log(`  ✓ glossary.html (${Object.keys(glossary).length} terms)`);
  }

  return { chapters, glossary };
}

/**
 * Main build function.
 *
 * @param {object} [options] - Build options
 * @param {string} [options.lang] - Build only this language
 * @param {string} [options.projectRoot] - Project root (defaults to cwd)
 */
export async function build(options = {}) {
  const projectRoot = options.projectRoot || process.cwd();
  const config = await resolveConfig(projectRoot);

  const bookName = config.bookTitles[config.baseLang] || 'Book';

  console.log('═══════════════════════════════════════════');
  console.log(` ${bookName} — Build (@eluno/core v2)`);
  console.log('═══════════════════════════════════════════');

  const languagesToBuild = options.lang ? [options.lang] : config.languages;

  // Pre-build cross-language slug map (always for all languages)
  const chapterSlugMap = buildChapterSlugMap(config);
  const glossaryMeta = config.features.glossary ? loadGlossaryMeta(config) : { categories: {}, terms: {} };

  // Ensure output directory
  ensureDir(config.outputDir);

  // Build each language
  const builtData = {};
  for (const lang of languagesToBuild) {
    builtData[lang] = buildLanguage(config, lang, chapterSlugMap, glossaryMeta);
  }

  // Create shared assets
  console.log('\n📦 Creating shared assets...');
  copyJsFiles(config);
  copyFonts(config);

  // Generate search indices (only if feature enabled)
  if (config.features.search) {
    console.log('\n🔍 Generating search indices...');
    for (const lang of languagesToBuild) {
      const { chapters, glossary } = builtData[lang];
      const searchIndex = generateSearchIndex(config, lang, chapters, glossary, glossaryMeta);
      const lp = langPrefix(config, lang);
      const searchDir = lp ? join(config.outputDir, lang) : config.outputDir;
      ensureDir(searchDir);
      writeFileSync(join(searchDir, 'search-index.json'), JSON.stringify(searchIndex));
      const label = lp ? `${lang}/search-index.json` : 'search-index.json';
      console.log(`  ✓ ${label} (${searchIndex.length} entries)`);
    }
  }

  // Root index with language detection
  generateRootIndex(config);

  // SEO files
  generateSitemap(config, chapterSlugMap);
  generateRobotsTxt(config);

  // Static files
  copyStaticFiles(config);

  console.log('\n═══════════════════════════════════════════');
  console.log(` ✅ Build complete!`);
  console.log(`    Output: ${config.outputDir}`);
  console.log('═══════════════════════════════════════════\n');
}
