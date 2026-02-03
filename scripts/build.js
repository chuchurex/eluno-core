/**
 * Build Script for The Teachings (Gentle Version)
 *
 * Generates HTML files from JSON content and SASS
 * Supports multiple languages (EN, ES)
 *
 * Output structure:
 *   dist/
 *   ├── index.html          (TOC - English)
 *   ├── ch1/index.html      (Chapter 1 - English)
 *   ├── ch2/index.html      (Chapter 2 - English)
 *   ├── ...
 *   └── es/
 *       ├── index.html      (TOC - Spanish)
 *       ├── ch1/index.html  (Chapter 1 - Spanish)
 *       └── ...
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = process.cwd();
const CORE_ROOT = path.join(__dirname, '..');

require('dotenv').config({ path: path.join(PROJECT_ROOT, '.env') });

// Domain Configuration (from .env)
const DOMAIN = process.env.DOMAIN || 'theteachings.example.com';
const STATIC_SUBDOMAIN = process.env.STATIC_SUBDOMAIN || 'static';
const PROJECT_SLUG = process.env.PROJECT_SLUG || '';
const SITE_URL = `https://${DOMAIN}`;
// If STATIC_SUBDOMAIN contains a dot, it's a full domain; otherwise prepend to DOMAIN
// If PROJECT_SLUG is present, append it to create namespaced static paths
const STATIC_BASE_URL = (STATIC_SUBDOMAIN.includes('.')
  ? `https://${STATIC_SUBDOMAIN}`
  : `https://${STATIC_SUBDOMAIN}.${DOMAIN}`) + (PROJECT_SLUG ? `/${PROJECT_SLUG}` : '');

// Configuration
// Configuration
const LANGUAGES = (process.env.LANGUAGES || 'en,es').split(',');
const BASE_LANG = process.env.BASE_LANG || 'en';
const I18N_DIR = path.join(PROJECT_ROOT, 'i18n');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');


// Load JSON file
function loadJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.warn(`Warning: Could not load ${filePath}`);
    return null;
  }
}

// Resolve asset URL (local or external)
function resolveUrl(url) {
  if (!url) return '';
  if (url.startsWith('/') && !url.startsWith('//')) {
    return STATIC_BASE_URL + url;
  }
  return url;
}


// Process text with term markers, references, and emphasis
function processText(text, glossary, references) {
  // Replace {term:id} or {term:id|text} with HTML
  text = text.replace(/\{term:([^}|]+)(?:\|([^}]+))?\}/g, (match, termId, customText) => {
    const displayText = customText || glossary[termId]?.title || termId;
    return `<span class="term" data-note="${termId}">${displayText}</span>`;
  });

  // Replace {ref:id} with HTML (reference marker - superscript)
  if (references) {
    text = text.replace(/\{ref:([^}]+)\}/g, (match, refId) => {
      const ref = references[refId];
      // Only render if reference exists AND has a summary
      if (ref && ref.summary) {
        return `<sup class="ref" data-ref="${refId}" title="${ref.title}">&#42;</sup>`;
      }
      // If reference exists but has no summary, hide it (return empty string)
      if (ref) return '';

      return match;
    });
  }

  // Replace **text** with <strong>
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Replace *text* with <em>
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  return text;
}

// Generate section HTML
function generateSection(section, glossary, references) {
  let html = `                <section class="section" id="${section.id}">\n`;
  html += `                    <h2 class="sec-title">${section.title}</h2>\n`;

  section.content.forEach(block => {
    const processedText = processText(block.text, glossary, references);
    if (block.type === 'paragraph') {
      html += `                    <p>${processedText}</p>\n`;
    } else if (block.type === 'quote') {
      html += `                    <div class="quote">${processedText}</div>\n`;
    }
  });

  html += `                </section>\n`;
  return html;
}

// Generate media toolbar HTML (Audio, PDF, YouTube) - Inline with accordion
function generateMediaToolbar(chapterNum, media, ui, lang) {
  if (!media || !ui.media) return '';

  const chapterMedia = media[String(chapterNum)];
  if (!chapterMedia) return '';

  const hasPdf = !!chapterMedia.pdf;
  const hasAudio = !!chapterMedia.audio;
  const hasYoutube = !!chapterMedia.youtube;

  // If nothing available, return empty
  if (!hasPdf && !hasAudio && !hasYoutube) return '';

  let html = '';

  // SVG icons - 22px size
  const svgPdf = `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 2l5 5h-5V4zm-2 14l-4-4h2.5v-4h3v4H15l-4 4z"/></svg>`;
  const svgAudio = `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;
  const svgYoutube = `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M10 15l5.19-3L10 9v6m11.56-7.83c.13.47.22 1.1.28 1.9.07.8.1 1.49.1 2.09L22 12c0 2.19-.16 3.8-.44 4.83-.25.9-.83 1.48-1.73 1.73-.47.13-1.33.22-2.65.28-1.3.07-2.49.1-3.59.1L12 19c-4.19 0-6.8-.16-7.83-.44-.9-.25-1.48-.83-1.73-1.73-.13-.47-.22-1.1-.28-1.9-.07-.8-.1-1.49-.1-2.09L2 12c0-2.19.16-3.8.44-4.83.25-.9.83-1.48 1.73-1.73.47-.13 1.33-.22 2.65-.28 1.3-.07 2.49-.1 3.59-.1L12 5c4.19 0 6.8.16 7.83.44.9.25 1.48.83 1.73 1.73z"/></svg>`;

  // Get labels (with fallbacks)
  const labelPdf = ui.media.labelPdf || 'PDF';
  const labelAudio = ui.media.labelAudio || 'MP3';
  const labelYoutube = ui.media.labelYoutube || 'YouTube';

  // Icon bar - order: MP3, PDF, YouTube
  html += `                <div class="ch-media-bar">\n`;

  // Audio MP3: accordion toggle and panel
  if (hasAudio) {
    const audioUrl = resolveUrl(chapterMedia.audio);
    html += `                    <div class="ch-media-audio-panel" id="audio-panel-${chapterNum}">\n`;
    html += `                        <audio src="${audioUrl}" controls preload="none"></audio>\n`;
    html += `                    </div>\n`;
    html += `                    <button class="ch-media-icon" onclick="toggleAudio('${chapterNum}')" title="${ui.media.listenAudio || 'Escuchar audio'}" data-audio-btn="${chapterNum}">${svgAudio}<span class="ch-media-label">${labelAudio}</span></button>\n`;
  }

  // PDF: direct download link
  if (hasPdf) {
    const pdfUrl = resolveUrl(chapterMedia.pdf);
    html += `                    <a href="${pdfUrl}" class="ch-media-icon" title="${ui.media.downloadPdf}" download>${svgPdf}<span class="ch-media-label">${labelPdf}</span></a>\n`;
  }

  // YouTube: external link
  if (hasYoutube) {
    html += `                    <a href="${chapterMedia.youtube}" class="ch-media-icon" target="_blank" rel="noopener" title="${ui.media.listenAudio}">${svgYoutube}<span class="ch-media-label">${labelYoutube}</span></a>\n`;
  }

  html += `                </div>\n`;

  return html;
}

// Generate media toolbar for homepage (Direct download for MP3)
function generateHomepageMediaToolbar(media, ui) {
  if (!media || !ui.media) return '';

  const allMedia = media['all'];
  if (!allMedia) return '';

  const hasPdf = !!allMedia.pdf;
  const hasAudio = !!allMedia.audio;
  const hasYoutube = !!allMedia.youtube;

  if (!hasPdf && !hasAudio && !hasYoutube) return '';

  let html = '';

  const svgPdf = `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 2l5 5h-5V4zm-2 14l-4-4h2.5v-4h3v4H15l-4 4z"/></svg>`;
  const svgAudio = `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;
  const svgYoutube = `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M10 15l5.19-3L10 9v6m11.56-7.83c.13.47.22 1.1.28 1.9.07.8.1 1.49.1 2.09L22 12c0 2.19-.16 3.8-.44 4.83-.25.9-.83 1.48-1.73 1.73-.47.13-1.33.22-2.65.28-1.3.07-2.49.1-3.59.1L12 19c-4.19 0-6.8-.16-7.83-.44-.9-.25-1.48-.83-1.73-1.73-.13-.47-.22-1.1-.28-1.9-.07-.8-.1-1.49-.1-2.09L2 12c0-2.19.16-3.8.44-4.83.25-.9.83-1.48 1.73-1.73.47.13-1.33.22 2.65-.28 1.3-.07 2.49-.1 3.59-.1L12 5c4.19 0 6.8.16 7.83.44.9.25 1.48.83 1.73 1.73z"/></svg>`;

  const labelPdf = ui.media.labelPdf || 'Libro Completo (PDF)';
  const labelAudio = ui.media.labelAudio || 'Audiolibro (MP3)';
  const labelYoutube = ui.media.labelYoutube || 'Lista de Reproducción';

  html += `                <div class="ch-media-bar homepage-media">\n`;

  // Audio MP3: Direct download on homepage
  if (hasAudio) {
    const audioUrl = resolveUrl(allMedia.audio);
    html += `                    <a href="${audioUrl}" class="ch-media-icon" title="${ui.media.downloadAudio || 'Descargar audiolibro'}" download>${svgAudio}<span class="ch-media-label">${labelAudio}</span></a>\n`;
  }

  // PDF: Direct download link
  if (hasPdf) {
    const pdfUrl = resolveUrl(allMedia.pdf);
    html += `                    <a href="${pdfUrl}" class="ch-media-icon" title="${ui.media.downloadPdf}" download>${svgPdf}<span class="ch-media-label">${labelPdf}</span></a>\n`;
  }

  // YouTube: external link
  if (hasYoutube) {
    html += `                    <a href="${allMedia.youtube}" class="ch-media-icon" target="_blank" rel="noopener" title="${ui.media.playlistYoutube || 'Ver en YouTube'}">${svgYoutube}<span class="ch-media-label">${labelYoutube}</span></a>\n`;
  }

  html += `                </div>\n`;

  return html;
}

// Generate chapter HTML (for chapter page)
function generateChapterContent(chapter, glossary, references, media, ui, lang) {
  let html = `            <article class="chapter" id="${chapter.id}">\n`;
  html += `                <header class="ch-head">\n`;
  html += `                    <div class="ch-head-top">\n`;
  html += `                        <div class="ch-num">${chapter.numberText}</div>\n`;
  html += generateMediaToolbar(chapter.number, media, ui, lang);
  html += `                    </div>\n`;
  html += `                    <h1 class="ch-title">${chapter.title}</h1>\n`;
  html += `                </header>\n\n`;

  chapter.sections.forEach((section, index) => {
    html += generateSection(section, glossary, references);
    if (index < chapter.sections.length - 1) {
      html += `\n                <div class="divider">· · ·</div>\n\n`;
    }
  });

  html += `            </article>\n`;
  return html;
}

// Notes sidebar removed - keeping function stub for compatibility
// Generate notes/definitions sidebar
function generateNotes(glossary, references, ui) {
  if ((!glossary || Object.keys(glossary).length === 0) && (!references || Object.keys(references).length === 0)) return '';

  let html = `        <aside class="notes" id="notes">\n`;
  html += `            <div class="notes-head">${ui.nav.notesPanel || 'Notes & Definitions'}</div>\n`;

  // Empty state message
  let emptyMsg = ui.nav.notesEmpty || 'Click any highlighted term to see its definition.';
  // Hack to allow styling in empty message if passed from UI config, or default style
  // If ui.nav.notesEmpty contains 'class="term-hint"', replaces it with inline style
  emptyMsg = emptyMsg.replace('class="term-hint"', 'style="color:var(--gold);border-bottom:1px dotted var(--gold-dim)"');

  html += `            <div class="notes-empty" id="notes-empty">${emptyMsg}</div>\n\n`;

  // Glossary terms
  if (glossary) {
    Object.entries(glossary).forEach(([id, term]) => {
      html += `            <div class="note" id="note-${id}">\n`;
      html += `                <div class="note-title">${term.title}</div>\n`;
      html += `                <div class="note-content">\n`;
      // Support array of paragraphs or single string
      if (Array.isArray(term.content)) {
        term.content.forEach(p => {
          let processed = p.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
          processed = processed.replace(/\*([^*]+)\*/g, '<em>$1</em>');
          html += `                    <p>${processed}</p>\n`;
        });
      } else if (term.definition) {
        let processed = term.definition.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        processed = processed.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        html += `                    <p>${processed}</p>\n`;
      }
      html += `                </div>\n`;
      html += `            </div>\n`;
    });
  }

  // References
  if (references) {
    Object.entries(references).forEach(([id, ref]) => {
      html += `            <div class="note ref-note" id="ref-${id}">\n`;
      html += `                <div class="note-title"><span class="ref-icon">*</span> ${ref.title}</div>\n`;
      html += `                <div class="note-content">\n`;
      html += `                    <p>${ref.summary}</p>\n`;
      if (ref.learnMore) {
        html += `                    <p class="ref-link"><a href="${ref.learnMore}" target="_blank" rel="noopener">${ui.nav.learnMore || 'Learn more'} ↗</a></p>\n`;
      }
      html += `                </div>\n`;
      html += `            </div>\n`;
    });
  }

  html += `        </aside>\n`;
  return html;
}

// Generate navigation sidebar for chapter page
function generateChapterNav(chapters, currentChapter, ui, lang, allLangs) {
  const langPrefix = lang === BASE_LANG ? '' : `/${lang}`;

  let html = `        <nav class="nav" id="sidebar">\n`;

  // Language selector (floating at top right)
  html += generateSidebarLangSelector(lang, allLangs, `/ch${currentChapter.number}/`);

  // Back to index link
  html += `            <div class="nav-back">\n`;
  html += `                <a href="${langPrefix}/" class="nav-link">← ${ui.nav.backToIndex}</a>\n`;
  html += `            </div>\n`;

  html += `            <div class="nav-section">\n`;

  // Chapter links
  chapters.forEach(ch => {
    const isActive = ch.id === currentChapter.id;
    const chapterHref = `${langPrefix}/ch${ch.number}/`;

    html += `            <div class="nav-chapter-group${isActive ? ' active' : ''}" id="nav-group-${ch.id}">\n`;
    html += `                <div class="nav-chapter-header">\n`;
    html += `                    <a href="${chapterHref}" class="nav-link${isActive ? ' current' : ''}">${ch.number}. ${ch.title}</a>\n`;

    if (isActive) {
      html += `                    <button class="nav-chapter-toggle" onclick="toggleChapter('${ch.id}')" aria-label="Toggle sections">▾</button>\n`;
    }

    html += `                </div>\n`;

    if (isActive) {
      html += `                <div class="nav-sections-list">\n`;
      ch.sections.forEach(sec => {
        html += `                    <a href="#${sec.id}" class="nav-link sub" onclick="if(window.innerWidth<=1100)closeAll()">${sec.title}</a>\n`;
      });
      html += `                </div>\n`;
    }

    html += `            </div>\n`;
  });

  html += `            </div>\n`;

  // About link
  html += `            <div class="nav-footer-links">\n`;
  html += `                <a href="${langPrefix}/about/" class="nav-link">${ui.nav.about}</a>\n`;
  html += `            </div>\n`;

  html += `        </nav>\n`;
  return html;
}

// Generate navigation sidebar for TOC page
function generateTocNav(chapters, ui, lang, allLangs) {
  const langPrefix = lang === BASE_LANG ? '' : `/${lang}`;

  let html = `        <nav class="nav" id="sidebar">\n`;

  // Language selector (floating at top right)
  html += generateSidebarLangSelector(lang, allLangs, '/');

  html += `            <div class="nav-section">\n`;

  // Chapter links
  chapters.forEach(ch => {
    const chapterHref = `${langPrefix}/ch${ch.number}/`;

    html += `            <div class="nav-chapter-group" id="nav-group-${ch.id}">\n`;
    html += `                <div class="nav-chapter-header">\n`;
    html += `                    <a href="${chapterHref}" class="nav-link">${ch.number}. ${ch.title}</a>\n`;
    html += `                </div>\n`;
    html += `            </div>\n`;
  });

  html += `            </div>\n`;

  // About link
  html += `            <div class="nav-footer-links">\n`;
  html += `                <a href="${langPrefix}/about/" class="nav-link">${ui.nav.about}</a>\n`;
  html += `            </div>\n`;

  html += `        </nav>\n`;
  return html;
}

// Generate chapter navigation (prev/next)
function generateChapterPrevNext(chapters, currentIndex, ui, lang) {
  const langPrefix = lang === BASE_LANG ? '' : `/${lang}`;
  const prevChapter = currentIndex > 0 ? chapters[currentIndex - 1] : null;
  const nextChapter = currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : null;

  let html = `            <nav class="chapter-nav" aria-label="Chapter navigation">\n`;

  if (prevChapter) {
    html += `                <a href="${langPrefix}/ch${prevChapter.number}/" class="chapter-nav-link prev">\n`;
    html += `                    <span class="chapter-nav-label">← ${ui.nav.previousChapter}</span>\n`;
    html += `                    <span class="chapter-nav-title">${prevChapter.title}</span>\n`;
    html += `                </a>\n`;
  } else {
    html += `                <a href="${langPrefix}/" class="chapter-nav-link prev">\n`;
    html += `                    <span class="chapter-nav-label">← ${ui.nav.backToIndex}</span>\n`;
    html += `                    <span class="chapter-nav-title">${ui.nav.tableOfContents}</span>\n`;
    html += `                </a>\n`;
  }

  if (nextChapter) {
    html += `                <a href="${langPrefix}/ch${nextChapter.number}/" class="chapter-nav-link next">\n`;
    html += `                    <span class="chapter-nav-label">${ui.nav.nextChapter} →</span>\n`;
    html += `                    <span class="chapter-nav-title">${nextChapter.title}</span>\n`;
    html += `                </a>\n`;
  } else {
    html += `                <span class="chapter-nav-link next disabled"></span>\n`;
  }

  html += `            </nav>\n`;
  return html;
}

// Generate footer HTML
function generateFooter(ui, showFeedback = true) {
  let html = `            <footer class="footer">\n`;
  if (ui.footerVersion) {
    html += `                <p>${ui.footerVersion}</p>\n`;
  }


  // L/L Research Attribution
  if (ui.footer.attribution) {
    html += `                <div class="footer-attribution">\n`;
    html += `                    <p>${ui.footer.attribution}</p>\n`;
    html += `                    <p>${ui.footer.originalSessions} <a href="https://www.llresearch.org" target="_blank" rel="noopener">llresearch.org</a></p>\n`;
    html += `                    <p class="footer-copyright">© ${ui.footer.derivedFrom}</p>\n`;
    html += `                </div>\n`;
  }

  html += `            </footer>\n`;
  return html;
}

// Generate HTML head section
// pagePath is the path without language prefix (e.g., "/", "/ch1/")
function generateHead(lang, ui, allLangs, version, pagePath, cssPath, pageTitle, includeRedirect = false) {
  const langCode = lang === BASE_LANG ? 'en' : lang;
  // Full canonical path includes language prefix for non-base languages
  const canonicalPath = lang === BASE_LANG ? pagePath : `/${lang}${pagePath}`;

  let html = `<!DOCTYPE html>
<html lang="${langCode}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${pageTitle} | ${DOMAIN}</title>
    <meta name="description" content="${ui.description}">
    <meta name="robots" content="${process.env.INDEXABLE === 'true' ? 'index, follow' : 'noindex, nofollow'}">
    <link rel="canonical" href="${SITE_URL}${canonicalPath}">
${process.env.GA_ID ? `    <!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=${process.env.GA_ID}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${process.env.GA_ID}');
    </script>` : ''}
`;

  // Hreflang tags - pagePath is used to build correct URLs for each language
  allLangs.forEach(l => {
    const href = l === BASE_LANG ? pagePath : `/${l}${pagePath}`;
    html += `    <link rel="alternate" hreflang="${l}" href="${SITE_URL}${href}">\n`;
  });

  html += `    <meta property="og:type" content="book">
    <meta property="og:url" content="${SITE_URL}${canonicalPath}">
    <meta property="og:title" content="${pageTitle}">
    <meta property="og:description" content="${ui.description}">
    <meta property="og:locale" content="${langCode === 'en' ? 'en_US' : langCode === 'es' ? 'es_ES' : 'pt_BR'}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="theme-color" content="#0d0d0f">
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>✧</text></svg>">
    <link rel="preload" href="/fonts/cormorant-garamond-400.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="/fonts/spectral-400.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="stylesheet" href="/fonts/fonts.css">
    <link rel="stylesheet" href="${cssPath}css/main.css?v=${version}">
`;

  if (includeRedirect && lang === BASE_LANG) {
    // Generate redirect only for non-base languages
    const redirectLangs = allLangs.filter(l => l !== BASE_LANG);
    if (redirectLangs.length > 0) {
      let redirectScript = `    <script>\n        (function() {\n`;
      redirectScript += `            if (document.referrer && document.referrer.indexOf(window.location.host) !== -1) return;\n`;
      redirectScript += `            if (window.location.pathname.indexOf('/review') !== -1) return;\n`;
      redirectScript += `            var ln = (navigator.language || navigator.userLanguage || '${BASE_LANG}').toLowerCase();\n`;
      redirectLangs.forEach(l => {
        redirectScript += `            if (ln.indexOf('${l}') === 0) window.location.href = '/${l}/';\n`;
      });
      redirectScript += `        })();\n    </script>\n`;
      html += redirectScript;
    }
  }

  html += `</head>\n`;
  return html;
}

// Generate floating language selector (now hidden in favor of sidebar version)
function generateLangToggle(lang, allLangs, currentPage) {
  // Return empty string - language selector is now in sidebar
  return '';
}

// Generate language selector for sidebar
function generateSidebarLangSelector(lang, allLangs, currentPage) {
  if (allLangs.length <= 1) return ''; // Don't show if only one language

  let html = `            <div class="nav-lang-selector">\n`;

  allLangs.forEach((l, i) => {
    if (i > 0) html += ` | `;

    let href;
    if (currentPage.startsWith('/ch')) {
      // Chapter page
      const chNum = currentPage.match(/\/ch(\d+)\//)?.[1];
      href = l === BASE_LANG ? `/ch${chNum}/` : `/${l}/ch${chNum}/`;
    } else if (currentPage === '/about/') {
      // About page
      href = l === BASE_LANG ? '/about/' : `/${l}/about/`;
    } else {
      // TOC page
      href = l === BASE_LANG ? '/' : `/${l}/`;
    }

    const active = l === lang ? ' class="active"' : '';
    html += `<a href="${href}"${active}>${l.toUpperCase()}</a>`;
  });

  html += `            </div>\n`;
  return html;
}

// Generate common scripts
function generateScripts() {
  return `    <script>
        // Theme Management
        function initTheme() {
            const savedTheme = localStorage.getItem('theme');
            // const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            let currentTheme = 'dark';

            if (savedTheme) {
                currentTheme = savedTheme;
            }
            // Temporarily ignore system preference to enforce Dark Mode default per user request
            // else if (!systemDark) {
            //    currentTheme = 'light';
            // }

            if (currentTheme === 'light') {
                document.documentElement.setAttribute('data-theme', 'light');
                updateThemeButton('light');
            } else {
                document.documentElement.removeAttribute('data-theme'); // Ensure dark (default)
                updateThemeButton('dark');
            }
        }

        function toggleTheme() {
            const current = document.documentElement.getAttribute('data-theme');
            const newTheme = current === 'light' ? 'dark' : 'light';
            
            if (newTheme === 'light') {
                document.documentElement.setAttribute('data-theme', 'light');
            } else {
                document.documentElement.removeAttribute('data-theme');
            }
            
            localStorage.setItem('theme', newTheme);
            updateThemeButton(newTheme);
        }

        function updateThemeButton(theme) {
            const btns = document.querySelectorAll('.theme-toggle');
            btns.forEach(btn => {
                btn.innerHTML = theme === 'light' ? '☾' : '☀';
                btn.setAttribute('aria-label', theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode');
            });
        }

        // Run immediately
        initTheme();

        function toggleNav(){document.getElementById('sidebar').classList.toggle('open');document.getElementById('overlay').classList.toggle('active');document.getElementById('notes')?.classList.remove('open')}
        function toggleNotes(){document.getElementById('notes').classList.toggle('open');document.getElementById('overlay').classList.toggle('active');document.getElementById('sidebar').classList.remove('open')}
        function closeAll(){document.getElementById('sidebar').classList.remove('open');document.getElementById('notes')?.classList.remove('open');document.getElementById('overlay').classList.remove('active')}
        function toggleChapter(id){const g=document.getElementById('nav-group-'+id);if(g)g.classList.toggle('expanded')}
        function toggleAudio(num){
            const panel = document.getElementById('audio-panel-'+num);
            const btn = document.querySelector('[data-audio-btn="'+num+'"]');
            if(!panel || !btn) return;
            const isActive = panel.classList.contains('active');
            
            // Close all other audio panels
            document.querySelectorAll('.ch-media-audio-panel').forEach(p => {
                if(p.id !== 'audio-panel-'+num) {
                    p.classList.remove('active');
                    const a = p.querySelector('audio');
                    if(a) a.pause();
                }
            });
            document.querySelectorAll('[data-audio-btn]').forEach(b => b.classList.remove('active'));

            if(!isActive) {
                panel.classList.add('active');
                btn.classList.add('active');
                const audio = panel.querySelector('audio');
                if(audio && audio.paused) audio.play().catch(()=>{});
            } else {
                panel.classList.remove('active');
                btn.classList.remove('active');
                const audio = panel.querySelector('audio');
                if(audio) audio.pause();
            }
        }
        function toggleMediaPanel(type){const panel=document.getElementById('panel-'+type);const btn=document.querySelector('[data-panel="'+type+'"]');if(!panel||!btn)return;const isActive=panel.classList.contains('active');document.querySelectorAll('.ch-media-panel').forEach(p=>p.classList.remove('active'));document.querySelectorAll('.ch-media-icon').forEach(b=>b.classList.remove('active'));if(!isActive){panel.classList.add('active');btn.classList.add('active')}}
        document.querySelectorAll('.nav-link').forEach(l=>l.addEventListener('click',()=>{if(window.innerWidth<=1100)closeAll()}));

        // Terms and notes functionality
        document.addEventListener('DOMContentLoaded', function() {
            document.querySelectorAll('.term').forEach(t=>t.addEventListener('click',function(e){e.preventDefault();const noteId='note-'+this.dataset.note;const note=document.getElementById(noteId);if(!note)return;document.querySelectorAll('.term').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.ref').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.note').forEach(n=>n.classList.remove('active'));const ne=document.getElementById('notes-empty');if(ne)ne.style.display='none';this.classList.add('active');note.classList.add('active');if(window.innerWidth<=1100){document.getElementById('notes').classList.add('open');document.getElementById('overlay').classList.add('active')}note.scrollIntoView({behavior:'smooth',block:'nearest'})}));
            
            document.querySelectorAll('.ref').forEach(r=>r.addEventListener('click',function(e){e.preventDefault();const refId='ref-'+this.dataset.ref;const note=document.getElementById(refId);if(!note)return;document.querySelectorAll('.term').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.ref').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.note').forEach(n=>n.classList.remove('active'));const ne=document.getElementById('notes-empty');if(ne)ne.style.display='none';this.classList.add('active');note.classList.add('active');if(window.innerWidth<=1100){document.getElementById('notes').classList.add('open');document.getElementById('overlay').classList.add('active')}note.scrollIntoView({behavior:'smooth',block:'nearest'})}));
        });
    </script>`;
}

// Generate TOC (Table of Contents) page
function generateTocPage(lang, chapters, glossary, references, ui, allLangs, version) {
  const langPrefix = lang === BASE_LANG ? '' : `/${lang}`;
  const pagePath = '/'; // Path without language prefix
  const cssPath = lang === BASE_LANG ? '' : '../';

  let html = generateHead(lang, ui, allLangs, version, pagePath, cssPath, ui.bookTitle, true);

  html += `<body>
    <button class="toggle nav-toggle" onclick="toggleNav()">☰ ${ui.nav.index}</button>
${generateLangToggle(lang, allLangs, pagePath)}    <button class="toggle theme-toggle" onclick="toggleTheme()" aria-label="Toggle Theme">☀</button>
    <div class="overlay" id="overlay" onclick="closeAll()"></div>

    <div class="layout">
        <main class="main">
            <header class="toc-header">
                <h1 class="toc-title">${ui.bookTitle}</h1>
                <p class="toc-subtitle">${ui.description}</p>
            </header>

            <section class="introduction">
                <h2 class="intro-title">${ui.introduction.title}</h2>
                ${ui.introduction.content.map(p => `<p class="intro-text">${p}</p>`).join('\n                ')}
                ${generateHomepageMediaToolbar(loadJSON(path.join(I18N_DIR, lang, 'media.json')), ui)}
            </section>

            <section class="disclaimer-banner">
                <h3 class="disclaimer-title">${ui.disclaimer.title}</h3>
                <p>${ui.disclaimer.text1}</p>
                <p>${ui.disclaimer.text2}</p>
                <p>${ui.disclaimer.text3} <a href="https://www.llresearch.org" target="_blank" rel="noopener">llresearch.org</a> ${ui.disclaimer.text3b}</p>
            </section>

            <section class="toc-section">
                <div class="toc-chapters">
`;

  chapters.forEach(ch => {
    const chapterHref = `${langPrefix}/ch${ch.number}/`;
    html += `                    <a href="${chapterHref}" class="toc-chapter">\n`;
    html += `                        <span class="toc-chapter-num">${ch.numberText}</span>\n`;
    html += `                        <span class="toc-chapter-title">${ch.title}</span>\n`;
    html += `                        <span class="toc-chapter-arrow">→</span>\n`;
    html += `                    </a>\n`;
  });

  html += `                </div>
            </section>

`;
  html += generateFooter(ui, false);
  html += `        </main>\n\n`;
  html += generateTocNav(chapters, ui, lang, allLangs);
  html += '\n';
  html += generateNotes(glossary, references, ui);
  html += `    </div>

${generateScripts()}
</body>
</html>`;

  return html;
}

// Generate About page content
function generateAboutContent(about) {
  let html = `            <article class="chapter about-page">\n`;
  html += `                <header class="ch-head">\n`;
  html += `                    <h1 class="ch-title">${about.title}</h1>\n`;
  html += `                    <p class="about-subtitle">${about.subtitle}</p>\n`;
  html += `                </header>\n\n`;

  about.sections.forEach((section, index) => {
    html += `                <section class="section" id="${section.id}">\n`;
    html += `                    <h2 class="sec-title">${section.icon ? section.icon + ' ' : ''}${section.title}</h2>\n`;

    section.content.forEach(block => {
      if (block.type === 'paragraph') {
        let text = block.text;
        text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        html += `                    <p>${text}</p>\n`;
      } else if (block.type === 'quote') {
        let text = block.text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        html += `                    <div class="quote">${text}</div>\n`;
      } else if (block.type === 'timeline') {
        html += `                    <div class="about-timeline">\n`;
        block.items.forEach(item => {
          html += `                        <div class="timeline-item"><span class="timeline-time">${item.time}</span><span class="timeline-text">${item.text}</span></div>\n`;
        });
        html += `                    </div>\n`;
      } else if (block.type === 'stats') {
        html += `                    <div class="about-stats">\n`;
        block.items.forEach(item => {
          html += `                        <div class="stat"><div class="stat-number">${item.number}</div><div class="stat-label">${item.label}</div></div>\n`;
        });
        html += `                    </div>\n`;
      } else if (block.type === 'funfact') {
        html += `                    <div class="about-funfact">\n`;
        html += `                        <div class="funfact-title">${block.title}</div>\n`;
        html += `                        <p>${block.text}</p>\n`;
        html += `                    </div>\n`;
      } else if (block.type === 'credits') {
        html += `                    <div class="about-credits">\n`;
        block.items.forEach(item => {
          const roleText = item.link
            ? `<a href="${item.link}" target="_blank" rel="noopener noreferrer">${item.role}</a>`
            : item.role;
          html += `                        <p><strong>${roleText}:</strong> ${item.contribution}</p>\n`;
        });
        html += `                    </div>\n`;
      }
    });

    html += `                </section>\n`;
    if (index < about.sections.length - 1) {
      html += `\n                <div class="divider">· · ·</div>\n\n`;
    }
  });

  html += `\n                <footer class="about-footer">\n`;
  html += `                    <p>${about.footer.updated}</p>\n`;
  html += `                    <p>${about.footer.madeWith}</p>\n`;
  html += `                </footer>\n`;
  html += `            </article>\n`;
  return html;
}

// Generate navigation sidebar for About page
function generateAboutNav(chapters, about, ui, lang, allLangs) {
  const langPrefix = lang === BASE_LANG ? '' : `/${lang}`;

  let html = `        <nav class="nav" id="sidebar">\n`;

  // Language selector (floating at top right)
  html += generateSidebarLangSelector(lang, allLangs, '/about/');

  // Back to index link
  html += `            <div class="nav-back">\n`;
  html += `                <a href="${langPrefix}/" class="nav-link">← ${ui.nav.backToIndex}</a>\n`;
  html += `            </div>\n`;

  html += `            <div class="nav-section">\n`;
  html += `                <div class="nav-section-title">${about.title}</div>\n`;

  // Section links for about page
  about.sections.forEach(sec => {
    html += `                <a href="#${sec.id}" class="nav-link sub" onclick="if(window.innerWidth<=1100)closeAll()">${sec.icon ? sec.icon + ' ' : ''}${sec.title}</a>\n`;
  });

  html += `            </div>\n`;

  // Chapters section
  html += `            <div class="nav-section" style="margin-top:1.5rem">\n`;
  chapters.forEach(ch => {
    const chapterHref = `${langPrefix}/ch${ch.number}/`;
    html += `                <a href="${chapterHref}" class="nav-link">${ch.number}. ${ch.title}</a>\n`;
  });
  html += `            </div>\n`;

  html += `        </nav>\n`;
  return html;
}

// Generate About page
function generateAboutPage(lang, chapters, about, glossary, ui, allLangs, version) {
  const langPrefix = lang === BASE_LANG ? '' : `/${lang}`;
  const pagePath = '/about/';
  const cssPath = lang === BASE_LANG ? '../' : '../../';
  const pageTitle = about.title;

  let html = generateHead(lang, ui, allLangs, version, pagePath, cssPath, pageTitle, false);

  html += `<body>
    <button class="toggle nav-toggle" onclick="toggleNav()">☰ ${ui.nav.index}</button>
${generateLangToggle(lang, allLangs, pagePath)}    <button class="toggle theme-toggle" onclick="toggleTheme()" aria-label="Toggle Theme">☀</button>
    <div class="overlay" id="overlay" onclick="closeAll()"></div>

    <div class="layout">
        <main class="main">
`;

  html += generateAboutContent(about);
  html += `        </main>\n\n`;
  html += generateAboutNav(chapters, about, ui, lang, allLangs);
  html += '\n';
  html += generateNotes(glossary, null, ui);
  html += `    </div>

${generateScripts()}
</body>
</html>`;

  return html;
}

// Generate individual chapter page
function generateChapterPage(lang, chapters, chapterIndex, glossary, references, ui, allLangs, version, media) {
  const chapter = chapters[chapterIndex];
  const langPrefix = lang === BASE_LANG ? '' : `/${lang}`;
  const pagePath = `/ch${chapter.number}/`; // Path without language prefix
  const cssPath = lang === BASE_LANG ? '../' : '../../';
  const pageTitle = `${ui.nav.chapter} ${chapter.number}: ${chapter.title}`;

  let html = generateHead(lang, ui, allLangs, version, pagePath, cssPath, pageTitle, false);

  html += `<body>
    <button class="toggle nav-toggle" onclick="toggleNav()">☰ ${ui.nav.index}</button>
${generateLangToggle(lang, allLangs, pagePath)}    <button class="toggle theme-toggle" onclick="toggleTheme()" aria-label="Toggle Theme">☀</button>

    <div class="overlay" id="overlay" onclick="closeAll()"></div>

    <div class="layout">
        <main class="main">
`;

  html += generateChapterContent(chapter, glossary, references, media, ui, lang);
  html += '\n';
  html += generateChapterPrevNext(chapters, chapterIndex, ui, lang);
  html += '\n';
  html += generateFooter(ui, true);
  html += `        </main>\n\n`;
  html += generateChapterNav(chapters, chapter, ui, lang, allLangs);
  html += '\n';
  html += generateNotes(glossary, references, ui);
  html += `    </div>

${generateScripts()}
</body>
</html>`;

  return html;
}

// Main build function
function build() {
  console.log(`🔨 Building ${DOMAIN}...\n`);

  // Ensure dist directories exist
  LANGUAGES.forEach(lang => {
    const dir = lang === BASE_LANG ? DIST_DIR : path.join(DIST_DIR, lang);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // Ensure CSS directory exists
  const cssDir = path.join(DIST_DIR, 'css');
  if (!fs.existsSync(cssDir)) {
    fs.mkdirSync(cssDir, { recursive: true });
  }

  const version = Date.now();

  LANGUAGES.forEach(lang => {
    console.log(`📖 Building ${lang.toUpperCase()} version...`);

    // Load UI strings (fall back to EN if not available)
    let ui = loadJSON(path.join(I18N_DIR, lang, 'ui.json'));
    if (!ui) {
      ui = loadJSON(path.join(I18N_DIR, BASE_LANG, 'ui.json'));
    }

    // Load glossary (fall back to EN if not available)
    let glossary = loadJSON(path.join(I18N_DIR, lang, 'glossary.json'));
    if (!glossary) {
      glossary = loadJSON(path.join(I18N_DIR, BASE_LANG, 'glossary.json'));
    }

    // Load references (fall back to EN if not available)
    let references = loadJSON(path.join(I18N_DIR, lang, 'references.json'));
    if (!references) {
      references = loadJSON(path.join(I18N_DIR, BASE_LANG, 'references.json'));
    }

    // Load media configuration (optional, per language)
    const media = loadJSON(path.join(I18N_DIR, lang, 'media.json'));

    // Load chapters (fall back to EN if not available)
    const chapters = [];
    const chaptersDir = path.join(I18N_DIR, lang, 'chapters');
    const defaultChaptersDir = path.join(I18N_DIR, BASE_LANG, 'chapters');

    // Get chapter files (exclude *_corregido.json backup files)
    let chapterFiles = [];
    if (fs.existsSync(chaptersDir)) {
      chapterFiles = fs.readdirSync(chaptersDir).filter(f => f.endsWith('.json') && !f.includes('_corregido')).sort();
    }
    if (chapterFiles.length === 0 && fs.existsSync(defaultChaptersDir)) {
      chapterFiles = fs.readdirSync(defaultChaptersDir).filter(f => f.endsWith('.json') && !f.includes('_corregido')).sort();
    }

    chapterFiles.forEach(file => {
      let chapter = loadJSON(path.join(chaptersDir, file));
      if (!chapter) {
        chapter = loadJSON(path.join(defaultChaptersDir, file));
      }
      if (chapter) {
        chapters.push(chapter);
      }
    });

    // Generate TOC page
    const tocHtml = generateTocPage(lang, chapters, glossary, references, ui, LANGUAGES, version);
    const tocPath = lang === BASE_LANG
      ? path.join(DIST_DIR, 'index.html')
      : path.join(DIST_DIR, lang, 'index.html');
    fs.writeFileSync(tocPath, tocHtml);
    console.log(`   ✅ ${tocPath}`);

    // Generate individual chapter pages
    chapters.forEach((chapter, index) => {
      const chapterDir = lang === BASE_LANG
        ? path.join(DIST_DIR, `ch${chapter.number}`)
        : path.join(DIST_DIR, lang, `ch${chapter.number}`);

      if (!fs.existsSync(chapterDir)) {
        fs.mkdirSync(chapterDir, { recursive: true });
      }

      const chapterHtml = generateChapterPage(lang, chapters, index, glossary, references, ui, LANGUAGES, version, media);
      const chapterPath = path.join(chapterDir, 'index.html');
      fs.writeFileSync(chapterPath, chapterHtml);
      console.log(`   ✅ ${chapterPath}`);
    });

    // Generate About page
    const about = loadJSON(path.join(I18N_DIR, lang, 'about.json'));
    if (about) {
      const aboutDir = lang === BASE_LANG
        ? path.join(DIST_DIR, 'about')
        : path.join(DIST_DIR, lang, 'about');

      if (!fs.existsSync(aboutDir)) {
        fs.mkdirSync(aboutDir, { recursive: true });
      }

      const aboutHtml = generateAboutPage(lang, chapters, about, glossary, ui, LANGUAGES, version);
      const aboutPath = path.join(aboutDir, 'index.html');
      fs.writeFileSync(aboutPath, aboutHtml);
      console.log(`   ✅ ${aboutPath}`);
    }
  });

  // Copy og-image if exists
  // Copy og-image if exists
  let ogSrc = path.join(PROJECT_ROOT, 'og-image.jpg');
  if (!fs.existsSync(ogSrc)) {
    ogSrc = path.join(CORE_ROOT, 'og-image.jpg');
  }
  const ogDest = path.join(DIST_DIR, 'og-image.jpg');
  if (fs.existsSync(ogSrc)) {
    fs.copyFileSync(ogSrc, ogDest);
    console.log(`\n📷 Copied og-image.jpg`);
  }

  // Copy .htaccess if exists (check project root first, then core)
  const htProjectSrc = path.join(PROJECT_ROOT, '.htaccess');
  const htCoreSrc = path.join(CORE_ROOT, '.htaccess');
  const htDest = path.join(DIST_DIR, '.htaccess');
  if (fs.existsSync(htProjectSrc)) {
    fs.copyFileSync(htProjectSrc, htDest);
    console.log(`📄 Copied .htaccess from project`);
  } else if (fs.existsSync(htCoreSrc)) {
    fs.copyFileSync(htCoreSrc, htDest);
    console.log(`📄 Copied .htaccess from core`);
  }

  // Generate _headers from template (replaces {{DOMAIN}} placeholder)
  const headersTemplate = path.join(CORE_ROOT, '_headers.template');
  const headersDest = path.join(DIST_DIR, '_headers');
  if (fs.existsSync(headersTemplate)) {
    let headersContent = fs.readFileSync(headersTemplate, 'utf8');
    headersContent = headersContent.replace(/\{\{DOMAIN\}\}/g, DOMAIN);
    fs.writeFileSync(headersDest, headersContent);
    console.log(`📋 Generated _headers (domain: ${DOMAIN})`);
  }

  // Copy fonts folder
  const fontsSrc = path.join(CORE_ROOT, 'fonts');
  const fontsDest = path.join(DIST_DIR, 'fonts');
  if (fs.existsSync(fontsSrc)) {
    if (!fs.existsSync(fontsDest)) {
      fs.mkdirSync(fontsDest, { recursive: true });
    }
    const fontFiles = fs.readdirSync(fontsSrc).filter(f => f.endsWith('.woff2') || f.endsWith('.css'));
    fontFiles.forEach(file => {
      fs.copyFileSync(path.join(fontsSrc, file), path.join(fontsDest, file));
    });
    console.log(`🔤 Copied ${fontFiles.length} font files`);
  }

  // Copy icons if they exist (e.g. android-chrome)
  // Not strictly needed if everything is inline SVG/data URI, but good practice if listed in manifest

  // Copy _redirects file if it exists (for Cloudflare Pages redirects)
  const redirectsSrc = path.join(PROJECT_ROOT, '_redirects');
  const redirectsDest = path.join(DIST_DIR, '_redirects');
  if (fs.existsSync(redirectsSrc)) {
    fs.copyFileSync(redirectsSrc, redirectsDest);
    console.log('🔀 Copied _redirects file');
  }

  // Note: API is now handled by Cloudflare Pages Functions (see /functions folder)

  console.log('\n✨ Build complete!\n');
}

// Run build
build();
