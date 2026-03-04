/**
 * Navigation components — sidebar, prev/next, language selector
 */

import { slugify } from './content.js';
import { loadChapters } from './chapters.js';

/**
 * Build chapter URL based on config pattern.
 * 'slug': /{lang}/chapters/{slug}.html
 * 'numeric': /{lang}/ch{N}/index.html  (base lang may omit prefix)
 */
export function chapterUrl(config, lang, chapter) {
  if (config.chapterUrlPattern === 'numeric') {
    const prefix = (!config.baseLangPrefix && lang === config.baseLang) ? '' : `/${lang}`;
    return `${prefix}/ch${chapter.number}/index.html`;
  }
  const slug = slugify(chapter.title);
  return `/${lang}/chapters/${slug}.html`;
}

/**
 * Build chapter URL from slug map (for cross-language links).
 */
export function chapterUrlFromSlug(config, lang, slug) {
  if (config.chapterUrlPattern === 'numeric') {
    // For numeric, slug is the chapter number
    const prefix = (!config.baseLangPrefix && lang === config.baseLang) ? '' : `/${lang}`;
    return `${prefix}/ch${slug}/index.html`;
  }
  return `/${lang}/chapters/${slug}.html`;
}

/**
 * Build a map of chapter slugs per language for cross-language linking.
 * Returns { en: { 1: 'cosmology-and-genesis' }, es: { 1: 'cosmologia-y-genesis' }, ... }
 * For numeric pattern, stores the chapter number instead of slug.
 */
export function buildChapterSlugMap(config) {
  const slugMap = {};
  for (const lang of config.languages) {
    slugMap[lang] = {};
    const chapters = loadChapters(config, lang);
    for (const ch of chapters) {
      if (config.chapterUrlPattern === 'numeric') {
        slugMap[lang][ch.number] = ch.number;
      } else {
        slugMap[lang][ch.number] = slugify(ch.title);
      }
    }
  }
  return slugMap;
}

/**
 * Language name labels.
 */
const LANG_LABELS = { en: 'English', es: 'Español', pt: 'Português' };

/**
 * Generate navigation sidebar for chapter pages.
 */
export function generateNavSidebar(config, chapter, allChapters, lang, ui, chapterSlugMap) {
  const bookTitle = config.bookTitles[lang];

  // Language selector
  const langSelector = config.languages
    .filter(l => chapterSlugMap[l] && chapterSlugMap[l][chapter.number])
    .map((l, i) => {
      const active = l === lang ? ' class="active"' : '';
      const prefix = i > 0 ? ' | ' : '';
      const targetSlug = chapterSlugMap[l][chapter.number];
      const href = chapterUrlFromSlug(config, l, targetSlug);
      const ariaLabel = LANG_LABELS[l] || l;
      return `${prefix}<a href="${href}"${active} onclick="localStorage.setItem('lang','${l}')" aria-label="${ariaLabel}">${l.toUpperCase()}</a>`;
    })
    .join('');

  // Chapter links
  const chapterLinks = allChapters
    .map(ch => {
      const isActive = ch.id === chapter.id;
      const href = chapterUrl(config, lang, ch);

      let html = `            <div class="nav-chapter-group${isActive ? ' active' : ''}" id="nav-group-${ch.id}">\n`;
      html += `                <div class="nav-chapter-header">\n`;
      html += `                    <a href="${href}" class="nav-link${isActive ? ' current' : ''}">${ch.number}. ${ch.title}</a>\n`;

      if (isActive) {
        html += `                    <button class="nav-chapter-toggle" data-action="toggle-chapter" data-chapter="${ch.id}" aria-label="${ui.ariaToggleSections}" aria-expanded="false">▾</button>\n`;
        html += `                </div>\n`;
        html += `                <div class="nav-sections-list">\n`;
        ch.sections.forEach(sec => {
          html += `                    <a href="#${sec.id}" class="nav-link sub" data-action="nav-link-close">${sec.title}</a>\n`;
        });
        html += `                </div>\n`;
      } else {
        html += `                </div>\n`;
      }

      html += `            </div>\n`;
      return html;
    })
    .join('');

  return `        <nav class="nav" id="sidebar">
            <div class="nav-lang-selector">${langSelector}</div>
            <div class="nav-back">
                <a href="/${lang}/" class="nav-link">← ${ui.home}</a>
            </div>
            <div class="nav-section">
${chapterLinks}            </div>
            <div class="nav-back nav-back--footer">
                <a href="/${lang}/glossary.html" class="nav-link">${ui.glossaryPage}</a>
                <a href="/${lang}/about.html" class="nav-link">${ui.about}</a>
            </div>
        </nav>`;
}

/**
 * Generate simple navigation sidebar for about/glossary pages.
 */
export function generatePageNavSidebar(config, allChapters, lang, ui, currentPage) {
  const langSelector = config.languages
    .map((l, i) => {
      const active = l === lang ? ' class="active"' : '';
      const prefix = i > 0 ? ' | ' : '';
      const ariaLabel = LANG_LABELS[l] || l;
      return `${prefix}<a href="/${l}/${currentPage}"${active} onclick="localStorage.setItem('lang','${l}')" aria-label="${ariaLabel}">${l.toUpperCase()}</a>`;
    })
    .join('');

  const chapterLinks = allChapters
    .map(ch => {
      const href = chapterUrl(config, lang, ch);
      return `            <div class="nav-chapter-group" id="nav-group-${ch.id}">
                <div class="nav-chapter-header">
                    <a href="${href}" class="nav-link">${ch.number}. ${ch.title}</a>
                </div>
            </div>\n`;
    })
    .join('');

  const glossaryActive = currentPage === 'glossary.html' ? ' current' : '';
  const aboutActive = currentPage === 'about.html' ? ' current' : '';

  return `        <nav class="nav" id="sidebar">
            <div class="nav-lang-selector">${langSelector}</div>
            <div class="nav-back">
                <a href="/${lang}/" class="nav-link">← ${ui.home}</a>
            </div>
            <div class="nav-section">
${chapterLinks}            </div>
            <div class="nav-back nav-back--footer">
                <a href="/${lang}/glossary.html" class="nav-link${glossaryActive}">${ui.glossaryPage}</a>
                <a href="/${lang}/about.html" class="nav-link${aboutActive}">${ui.about}</a>
            </div>
        </nav>`;
}

/**
 * Generate chapter prev/next navigation.
 */
export function generateChapterPrevNext(config, chapter, allChapters, lang, ui) {
  const chapterIndex = allChapters.findIndex(c => c.id === chapter.id);
  const prevChapter = allChapters[chapterIndex - 1];
  const nextChapter = allChapters[chapterIndex + 1];
  const bookTitle = config.bookTitles[lang];

  let html = `            <nav class="chapter-nav" aria-label="${ui.ariaChapterNav}">\n`;

  if (prevChapter) {
    const href = chapterUrl(config, lang, prevChapter);
    html += `                <a href="${href}" class="chapter-nav-link prev">\n`;
    html += `                    <span class="chapter-nav-label">← ${ui.previous}</span>\n`;
    html += `                    <span class="chapter-nav-title">${prevChapter.title}</span>\n`;
    html += `                </a>\n`;
  } else {
    html += `                <a href="/${lang}/" class="chapter-nav-link prev">\n`;
    html += `                    <span class="chapter-nav-label">← ${ui.home}</span>\n`;
    html += `                    <span class="chapter-nav-title">${bookTitle}</span>\n`;
    html += `                </a>\n`;
  }

  if (nextChapter) {
    const href = chapterUrl(config, lang, nextChapter);
    html += `                <a href="${href}" class="chapter-nav-link next">\n`;
    html += `                    <span class="chapter-nav-label">${ui.next} →</span>\n`;
    html += `                    <span class="chapter-nav-title">${nextChapter.title}</span>\n`;
    html += `                </a>\n`;
  } else {
    html += `                <span class="chapter-nav-link next disabled"></span>\n`;
  }

  html += `            </nav>\n`;
  return html;
}
