/**
 * HTML page generators — chapter, index, about, glossary
 *
 * Composes from head, footer, navigation, and content modules.
 */

import { generateHead } from './head.js';
import { generateFooter, generateIndexFooter } from './footer.js';
import {
  generateNavSidebar,
  generatePageNavSidebar,
  generateChapterPrevNext,
  chapterUrl,
  chapterUrlFromSlug,
  langPrefix
} from './navigation.js';
import { parseTerms, parseRefs, cleanTextForMeta, slugify, processText } from './content.js';

// ─────────────────────────────────────────────────────────────
// SVG icons
// ─────────────────────────────────────────────────────────────

const MEDIA_SVG = {
  pdf: '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 2l5 5h-5V4zm-2 14l-4-4h2.5v-4h3v4H15l-4 4z"/></svg>',
  audio: '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>',
  youtube: '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M10 15l5.19-3L10 9v6m11.56-7.83c.13.47.22 1.1.28 1.9.07.8.1 1.49.1 2.09L22 12c0 2.19-.16 3.8-.44 4.83-.25.9-.83 1.48-1.73 1.73-.47.13-1.33.22-2.65.28-1.3.07-2.49.1-3.59.1L12 19c-4.19 0-6.8-.16-7.83-.44-.9-.25-1.48-.83-1.73-1.73-.13-.47-.22-1.1-.28-1.9-.07-.8-.1-1.49-.1-2.09L2 12c0-2.19.16-3.8.44-4.83.25-.9.83-1.48 1.73-1.73.47-.13 1.33-.22 2.65-.28 1.3-.07 2.49-.1 3.59-.1L12 5c4.19 0 6.8.16 7.83.44.9.25 1.48.83 1.73 1.73z"/></svg>'
};

const INFO_ICON = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.2"/><path d="M8 4v1M8 7v5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>';

// ─────────────────────────────────────────────────────────────
// Content rendering helpers
// ─────────────────────────────────────────────────────────────

function renderContentBlock(block, glossary, features) {
  switch (block.type) {
    case 'paragraph': {
      let text = processText(block.text, glossary, features);
      return `<p>${text}</p>`;
    }
    case 'quote':
      return `<blockquote>${block.text}</blockquote>`;
    case 'separator':
      return `<div class="separator">${block.text || '· · ·'}</div>`;
    default:
      console.warn(`  ⚠ Unknown content type: ${block.type}`);
      return '';
  }
}

function renderSection(config, section, glossary, lang, chapterNum, sectionIdx) {
  const ui = config.ui[lang] || config.ui[config.baseLang];
  const sectionNumber = `${chapterNum}.${sectionIdx}`;
  const contentHtml = section.content
    .map(block => renderContentBlock(block, glossary, config.features))
    .join('\n        ');

  return `
      <section class="section" id="${section.id}" data-section-title="${section.title}" data-section-number="${sectionNumber}">
        <h2 class="sec-title">
          <span class="sec-title-text">${section.title}</span>
          <button class="sec-context-btn" data-target="${section.id}" aria-label="${ui.sources}" title="${ui.sources}">${INFO_ICON}</button>
        </h2>
        ${contentHtml}
      </section>
  `;
}

// ─────────────────────────────────────────────────────────────
// Media toolbar
// ─────────────────────────────────────────────────────────────

function generateMediaToolbar(chapterNum, media, ui) {
  if (!media) return '';
  const chapterMedia = media[String(chapterNum)];
  if (!chapterMedia) return '';

  const hasPdf = !!chapterMedia.pdf;
  const hasAudio = !!chapterMedia.audio;
  const hasYoutube = !!chapterMedia.youtube;
  if (!hasPdf && !hasAudio && !hasYoutube) return '';

  let html = `                <div class="ch-media-bar">\n`;

  if (hasAudio) {
    html += `                    <div class="ch-media-audio-panel" id="audio-panel-${chapterNum}">\n`;
    html += `                        <audio src="${chapterMedia.audio}" controls preload="none"></audio>\n`;
    html += `                    </div>\n`;
    html += `                    <button class="ch-media-icon" data-action="toggle-audio" data-audio="${chapterNum}" title="${ui.listenAudio}" data-audio-btn="${chapterNum}">${MEDIA_SVG.audio}<span class="ch-media-label">MP3</span></button>\n`;
  }

  if (hasPdf) {
    html += `                    <a href="${chapterMedia.pdf}" class="ch-media-icon" title="${ui.downloadPdf}" download>${MEDIA_SVG.pdf}<span class="ch-media-label">PDF</span></a>\n`;
  }

  if (hasYoutube) {
    html += `                    <a href="${chapterMedia.youtube}" class="ch-media-icon" target="_blank" rel="noopener" title="YouTube">${MEDIA_SVG.youtube}<span class="ch-media-label">YouTube</span></a>\n`;
  }

  html += `                </div>\n`;
  return html;
}

function generateHomepageMediaToolbar(media, ui) {
  if (!media || !media.all) return '';
  const allMedia = media.all;

  const hasPdf = !!allMedia.pdf;
  const hasAudio = !!allMedia.audio;
  const hasYoutube = !!allMedia.youtube;
  if (!hasPdf && !hasAudio && !hasYoutube) return '';

  let html = `        <div class="ch-media-bar homepage-media">\n`;

  if (hasAudio) {
    html += `          <a href="${allMedia.audio}" class="ch-media-icon" title="${ui.listenAudio}" download>${MEDIA_SVG.audio}<span class="ch-media-label">MP3</span></a>\n`;
  }
  if (hasPdf) {
    html += `          <a href="${allMedia.pdf}" class="ch-media-icon" title="${ui.downloadPdf}" download>${MEDIA_SVG.pdf}<span class="ch-media-label">PDF</span></a>\n`;
  }
  if (hasYoutube) {
    html += `          <a href="${allMedia.youtube}" class="ch-media-icon" target="_blank" rel="noopener" title="YouTube">${MEDIA_SVG.youtube}<span class="ch-media-label">YouTube</span></a>\n`;
  }

  html += `        </div>\n`;
  return html;
}

// ─────────────────────────────────────────────────────────────
// Context sidebar (notes panel)
// ─────────────────────────────────────────────────────────────

function generateContextSidebar(config, chapter, glossary, provenance, lang, ui) {
  const emptyMsg = ui.notesEmpty || 'Click any <span class="term-example">highlighted term</span> to see its definition.';
  const sourcesLabel = ui.sources || 'Sources';
  const noSourcesMsg = ui.noSources || 'No source citations for this section.';

  // Glossary note items
  const noteItems = Object.entries(glossary)
    .map(([id, term]) => {
      const contentHtml = Array.isArray(term.content)
        ? term.content.map(p => {
            let processed = p.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
            processed = processed.replace(/\*([^*]+)\*/g, '<em>$1</em>');
            return `                        <p>${processed}</p>`;
          }).join('\n')
        : `                        <p>${term.content}</p>`;

      return `                <div class="note" id="note-${id}">
                    <div class="note-title">${term.title}</div>
                    <div class="note-content">
${contentHtml}
                    </div>
                </div>`;
    })
    .join('\n');

  // Per-section source blocks (provenance)
  let sourceBlocks = '';
  if (provenance && config.features.provenance) {
    const baseUrl = (config.lawOfOneUrls || {})[lang] || (config.lawOfOneUrls || {}).en || 'https://www.lawofone.info/s/';
    sourceBlocks = chapter.sections
      .map(section => {
        const secProv = provenance.provenance.find(p => p.section_id === section.id);
        if (!secProv || !secProv.segments || secProv.segments.length === 0) return '';

        const allSources = new Set();
        secProv.segments.forEach(seg => {
          seg.sources.forEach(src => allSources.add(src));
        });

        if (allSources.size === 0) return '';

        const links = Array.from(allSources)
          .filter(src => /^\d+\.\d+$/.test(src))
          .map(src => {
            const [session, question] = src.split('.');
            const url = `${baseUrl}${session}#${question}`;
            return `<a href="${url}" target="_blank" rel="noopener">${src}</a>`;
          });

        return `                <div class="notes-sources" data-section="${section.id}">${links.join(', ')}</div>`;
      })
      .filter(Boolean)
      .join('\n');
  }

  return `        <aside class="notes" id="notes">
            <div class="notes-context" id="notes-context">
                <div class="notes-context-label" id="notes-context-label">${chapter.number}. ${chapter.title}</div>
                <div class="notes-context-title" id="notes-context-title"></div>
            </div>

            <div class="notes-term-area" id="notes-term-area">
                <div class="notes-term-empty" id="notes-term-empty">${emptyMsg}</div>
${noteItems}
            </div>

            <div class="notes-sources-area" id="notes-sources-area">
                <div class="notes-sources-head">${sourcesLabel}</div>
                <div class="notes-sources-empty" id="notes-sources-empty">${noSourcesMsg}</div>
${sourceBlocks}
            </div>
        </aside>`;
}

// ─────────────────────────────────────────────────────────────
// Page generators
// ─────────────────────────────────────────────────────────────

/**
 * Generate full chapter HTML page.
 */
export function generateChapterHtml(config, chapter, lang, glossary, references, provenance, allChapters, chapterSlugMap, media) {
  const ui = config.ui[lang] || config.ui[config.baseLang];
  const bookTitle = config.bookTitles[lang];
  const slug = slugify(chapter.title);

  // Sections
  const sectionsHtml = chapter.sections
    .map((section, idx) => renderSection(config, section, glossary, lang, chapter.number, idx + 1))
    .join('\n');

  // Meta description
  const firstParagraph = chapter.sections[0]?.content[0]?.text || '';
  const metaDescription = cleanTextForMeta(firstParagraph, glossary).substring(0, 160);

  // URL building
  const lp = langPrefix(config, lang);
  const canonicalPath = config.chapterUrlPattern === 'numeric'
    ? `${lp}/ch${chapter.number}/index.html`
    : `${lp}/chapters/${slug}.html`;
  const canonicalUrl = `${config.siteUrl}${canonicalPath}`;

  // Components
  const head = generateHead(config, {
    title: `${chapter.title} — ${bookTitle}`,
    description: metaDescription,
    canonicalUrl,
    lang,
    ogType: 'article',
    hreflangUrlBuilder: (l) => {
      const s = chapterSlugMap[l]?.[chapter.number];
      if (!s) return '';
      const url = chapterUrlFromSlug(config, l, s);
      return `${config.siteUrl}${url}`;
    }
  });

  const navSidebar = generateNavSidebar(config, chapter, allChapters, lang, ui, chapterSlugMap);
  const notesSidebar = config.features.glossary
    ? generateContextSidebar(config, chapter, glossary, provenance, lang, ui)
    : '';
  const chapterPrevNext = generateChapterPrevNext(config, chapter, allChapters, lang, ui);
  const footer = generateFooter(config, ui, lang);
  const mediaToolbar = config.features.mediaToolbar
    ? generateMediaToolbar(chapter.number, media, ui)
    : '';

  const notesToggle = config.features.glossary
    ? `\n    <button class="toggle notes-toggle" data-action="toggle-notes" aria-expanded="false">${ui.glossary}</button>`
    : '';

  return `<!DOCTYPE html>
<html lang="${lang}" dir="ltr">
${head}
<body>
    <a href="#main-content" class="skip-link">${ui.skipToContent}</a>
    <button class="toggle nav-toggle" data-action="toggle-nav" aria-expanded="false">☰ ${ui.home}</button>${notesToggle}
    <button class="toggle theme-toggle" data-action="toggle-theme" aria-label="${ui.ariaToggleTheme}">☀</button>
    <div class="overlay" id="overlay" data-action="close-all" role="button" tabindex="-1" aria-label="${ui.closeMenu}"></div>

    <div class="layout">
        <main class="main" id="main-content">
            <article class="chapter" id="${chapter.id}">
                <header class="ch-head">
                    <div class="ch-head-top">
                        <div class="ch-num">${chapter.numberText}</div>
${mediaToolbar}
                    </div>
                    <h1 class="ch-title">${chapter.title}</h1>
                </header>

${sectionsHtml}
            </article>

${chapterPrevNext}
${footer}
        </main>

${navSidebar}

${notesSidebar}
    </div>

    <script src="/js/eluno.js?v=${config.buildHash}"></script>
</body>
</html>`;
}

/**
 * Generate index (table of contents) page.
 */
export function generateIndexHtml(config, lang, chapters, media) {
  const ui = config.ui[lang] || config.ui[config.baseLang];
  const bookTitle = config.bookTitles[lang];

  // Chapter cards
  const tocHtml = chapters
    .map(ch => {
      const href = chapterUrl(config, lang, ch);
      return `          <a href="${href}" class="toc-chapter">
            <span class="toc-chapter-num">${ch.numberText}</span>
            <span class="toc-chapter-title">${ch.title}</span>
            <span class="toc-chapter-arrow">→</span>
          </a>`;
    })
    .join('\n');

  // Language selector
  const langSwitcher = config.languages
    .map(l => {
      const isActive = l === lang ? ' class="active"' : '';
      const ariaLabel = { en: 'English', es: 'Español', pt: 'Português' }[l] || l;
      const lp = langPrefix(config, l);
      return `<a href="${lp}/"${isActive} onclick="localStorage.setItem('lang','${l}')" aria-label="${ariaLabel}">${l.toUpperCase()}</a>`;
    })
    .join(' | ');

  // Disclaimer
  const disclaimerHtml = (ui.disclaimer || [])
    .map(p => `          <p>${p}</p>`)
    .join('\n');

  // Search box (only if search enabled)
  const searchBox = config.features.search
    ? `\n      <div class="search-box" id="search-wrap" data-no-results="${ui.searchNoResults}" data-label-chapter="${ui.chapter}" data-label-glossary="${ui.glossary}">
        <input type="text" class="search-input" placeholder="${ui.searchPlaceholder}" id="site-search" autocomplete="off">
        <div class="search-results" id="search-results" hidden></div>
      </div>\n`
    : '';

  // Media toolbar
  const mediaToolbar = config.features.mediaToolbar
    ? generateHomepageMediaToolbar(media, ui)
    : '';

  // Footer
  const footer = generateIndexFooter(config, ui, lang);

  // Scripts
  const searchScript = config.features.search
    ? `\n  <script src="/js/search.js?v=${config.buildHash}" defer></script>`
    : '';

  const head = generateHead(config, {
    title: `${bookTitle} | ${config.siteDomain}`,
    description: ui.subtitle || '',
    canonicalUrl: `${config.siteUrl}${langPrefix(config, lang)}/`,
    lang,
    ogType: 'book',
    hreflangUrlBuilder: (l) => `${config.siteUrl}${langPrefix(config, l)}/`
  });

  return `<!DOCTYPE html>
<html lang="${lang}" dir="ltr">
${head}
<body>
  <a href="#main-content" class="skip-link">${ui.skipToContent}</a>
  <button class="toggle theme-toggle" data-action="toggle-theme" aria-label="${ui.ariaToggleTheme}">☀</button>

  <div class="layout index-layout">
    <main class="main" id="main-content">
      <header class="toc-header">
        <div class="toc-lang-selector">${langSwitcher}</div>
        <h1 class="toc-title">${bookTitle}</h1>
        <p class="toc-subtitle">${ui.subtitle}</p>
      </header>

      <section class="introduction">
        <p class="intro-text">${ui.intro}</p>
${mediaToolbar}
      </section>
${searchBox}
      <section class="disclaimer-banner">
        <h2 class="disclaimer-title">${ui.disclaimerTitle}</h2>
${disclaimerHtml}
      </section>

      <section class="toc-section">
        <h2 class="toc-section-title">${ui.tableOfContents}</h2>
        <div class="toc-chapters">
${tocHtml}
        </div>
      </section>

${footer}
    </main>
  </div>

  <script src="/js/eluno.js?v=${config.buildHash}" defer></script>${searchScript}
</body>
</html>`;
}

/**
 * Generate about page.
 */
export function generateAboutHtml(config, lang, about, allChapters, chapterSlugMap) {
  const ui = config.ui[lang] || config.ui[config.baseLang];
  const bookTitle = config.bookTitles[lang];

  const sectionsHtml = about.sections
    .map((section, idx) => {
      let html = `                <section class="section" id="${section.id}">\n`;
      html += `                    <h2 class="sec-title">${section.title || ''}</h2>\n`;
      section.content.forEach(block => {
        if (block.type === 'paragraph') {
          html += `                    <p>${block.text}</p>\n`;
        }
      });
      html += `                </section>`;
      if (idx < about.sections.length - 1) {
        html += `\n\n                <div class="divider">· · ·</div>\n`;
      }
      return html;
    })
    .join('\n');

  const navSidebar = generatePageNavSidebar(config, allChapters, lang, ui, 'about.html');
  const footer = generateFooter(config, ui, lang);

  const head = generateHead(config, {
    title: `${about.title} — ${bookTitle} | ${config.siteDomain}`,
    description: about.sections[0]?.content[0]?.text?.replace(/<[^>]*>/g, '').substring(0, 160) || '',
    canonicalUrl: `${config.siteUrl}${langPrefix(config, lang)}/about.html`,
    lang,
    ogType: 'website',
    hreflangUrlBuilder: (l) => `${config.siteUrl}${langPrefix(config, l)}/about.html`
  });

  return `<!DOCTYPE html>
<html lang="${lang}" dir="ltr">
${head}
<body>
    <a href="#main-content" class="skip-link">${ui.skipToContent}</a>
    <button class="toggle nav-toggle" data-action="toggle-nav" aria-expanded="false">☰ ${ui.home}</button>
    <button class="toggle theme-toggle" data-action="toggle-theme" aria-label="${ui.ariaToggleTheme}">☀</button>
    <div class="overlay" id="overlay" data-action="close-all" role="button" tabindex="-1" aria-label="${ui.closeMenu}"></div>

    <div class="layout">
        <main class="main" id="main-content">
            <article class="chapter about-page">
                <header class="ch-head">
                    <h1 class="ch-title">${about.title}</h1>
                </header>

${sectionsHtml}
            </article>

${footer}
        </main>

${navSidebar}
    </div>

    <script src="/js/eluno.js?v=${config.buildHash}"></script>
</body>
</html>`;
}

/**
 * Generate glossary page.
 */
export function generateGlossaryHtml(config, lang, glossary, glossaryMeta, allChapters, chapterSlugMap) {
  const ui = config.ui[lang] || config.ui[config.baseLang];
  const bookTitle = config.bookTitles[lang];
  const categories = glossaryMeta.categories || {};
  const termCategories = glossaryMeta.terms || {};

  // Sort terms alphabetically
  const sortedTerms = Object.entries(glossary)
    .sort(([, a], [, b]) => a.title.localeCompare(b.title, lang));

  // Group by first letter and assign sequential numbers
  const grouped = {};
  const termNumberMap = {};
  for (const [key, term] of sortedTerms) {
    const letter = term.title.charAt(0).toUpperCase();
    if (!grouped[letter]) grouped[letter] = [];
    const num = grouped[letter].length + 1;
    const numberId = `${letter.toLowerCase()}-${num}`;
    const catKey = termCategories[key] || 'uncategorized';
    termNumberMap[key] = { letter, num, id: numberId, category: catKey };
    grouped[letter].push({ key, ...term, numberLabel: `${letter}.${num}`, numberId, category: catKey });
  }

  // Build category groups
  const categoryGroups = {};
  for (const [key, term] of sortedTerms) {
    const catKey = termCategories[key] || 'uncategorized';
    if (!categoryGroups[catKey]) categoryGroups[catKey] = [];
    const info = termNumberMap[key];
    categoryGroups[catKey].push({ key, ...term, numberLabel: `${info.letter}.${info.num}`, numberId: info.id, category: catKey });
  }
  const catOrder = Object.keys(categories);
  const sortedCatKeys = [
    ...catOrder.filter(k => categoryGroups[k]),
    ...(categoryGroups['uncategorized'] ? ['uncategorized'] : [])
  ];

  function catLabel(catKey) {
    const def = categories[catKey];
    return def ? (def[lang] || def.en) : ui.glossaryUncategorized;
  }

  function renderContent(content) {
    if (Array.isArray(content)) {
      return content.map(p => {
        let processed = p.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        processed = processed.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        return `                        <p>${processed}</p>`;
      }).join('\n');
    }
    return `                        <p>${content}</p>`;
  }

  function renderTermEntry(term, useId) {
    const idAttr = useId ? ` id="${term.numberId}"` : '';
    const titleIdAttr = useId ? ` id="term-${term.key}"` : '';
    return `                    <div class="glossary-entry"${idAttr} data-term="${term.key}" data-category="${term.category}">
                        <div class="glossary-entry-header">
                            <span class="glossary-number" aria-label="Reference ${term.numberLabel}">${term.numberLabel}</span>
                            <h3 class="glossary-term-title"${titleIdAttr}>${term.title}</h3>
                            <span class="glossary-cat-tag" role="button" tabindex="0" data-cat="${term.category}">${catLabel(term.category)}</span>
                        </div>
${renderContent(term.content)}
                    </div>`;
  }

  // A-Z letter index
  const allLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const letterIndex = allLetters.map(l => {
    if (grouped[l]) {
      return `<a href="#letter-${l.toLowerCase()}" class="glossary-index-letter">${l}</a>`;
    }
    return `<span class="glossary-index-letter disabled">${l}</span>`;
  }).join('');

  // A-Z entries
  const azEntriesHtml = Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([letter, terms]) => {
      const termsHtml = terms.map(t => renderTermEntry(t, true)).join('\n');
      return `                <section class="glossary-letter" id="letter-${letter.toLowerCase()}">
                    <h2 class="glossary-letter-heading">${letter}</h2>
${termsHtml}
                </section>`;
    })
    .join('\n\n');

  // Category nav & entries (only if glossaryCategories enabled)
  let catNavButtons = '';
  let catEntriesHtml = '';
  let viewToggle = '';

  if (config.features.glossaryCategories) {
    catNavButtons = sortedCatKeys.map(ck =>
      `<a href="#cat-${ck}" class="glossary-cat-nav-btn">${catLabel(ck)}</a>`
    ).join('');

    catEntriesHtml = sortedCatKeys.map(ck => {
      const termsHtml = categoryGroups[ck].map(t => renderTermEntry(t, false)).join('\n');
      return `                <section class="glossary-category" id="cat-${ck}">
                    <h2 class="glossary-letter-heading">${catLabel(ck)}</h2>
${termsHtml}
                </section>`;
    }).join('\n\n');

    viewToggle = `
                <div class="glossary-view-toggle" role="tablist" aria-label="View mode">
                    <button class="glossary-view-btn active" role="tab" aria-selected="true" data-view="az">${ui.glossaryAlphabetical}</button>
                    <button class="glossary-view-btn" role="tab" aria-selected="false" data-view="categories">${ui.glossaryCategories}</button>
                </div>`;
  }

  const navSidebar = generatePageNavSidebar(config, allChapters, lang, ui, 'glossary.html');
  const footer = generateFooter(config, ui, lang);

  const head = generateHead(config, {
    title: `${ui.glossaryPage} — ${bookTitle} | ${config.siteDomain}`,
    description: ui.glossaryPageSubtitle,
    canonicalUrl: `${config.siteUrl}${langPrefix(config, lang)}/glossary.html`,
    lang,
    ogType: 'website',
    hreflangUrlBuilder: (l) => `${config.siteUrl}${langPrefix(config, l)}/glossary.html`
  });

  const catViewHtml = config.features.glossaryCategories
    ? `\n                <div class="glossary-view glossary-view-cat">
                <nav class="glossary-index glossary-cat-nav" aria-label="Category navigation">${catNavButtons}</nav>

${catEntriesHtml}
                </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="${lang}" dir="ltr">
${head}
<body>
    <a href="#main-content" class="skip-link">${ui.skipToContent}</a>
    <button class="toggle nav-toggle" data-action="toggle-nav" aria-expanded="false">☰ ${ui.home}</button>
    <button class="toggle theme-toggle" data-action="toggle-theme" aria-label="${ui.ariaToggleTheme}">☀</button>
    <div class="overlay" id="overlay" data-action="close-all" role="button" tabindex="-1" aria-label="${ui.closeMenu}"></div>

    <div class="layout">
        <main class="main" id="main-content">
            <article class="chapter glossary-page">
                <header class="ch-head">
                    <h1 class="ch-title">${ui.glossaryPage}</h1>
                    <p class="glossary-subtitle">${ui.glossaryPageSubtitle} (${sortedTerms.length})</p>
                    <input type="text" class="glossary-filter" placeholder="${ui.searchPlaceholder}" id="glossary-filter">
                </header>
${viewToggle}
                <div class="glossary-view glossary-view-az">
                <nav class="glossary-index" aria-label="Alphabetical index">${letterIndex}</nav>

${azEntriesHtml}
                </div>
${catViewHtml}
            </article>

${footer}
        </main>

${navSidebar}
    </div>

    <script src="/js/eluno.js?v=${config.buildHash}"></script>
    <script src="/js/glossary-page.js?v=${config.buildHash}" defer></script>
</body>
</html>`;
}
