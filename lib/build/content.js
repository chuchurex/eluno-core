/**
 * Content processing — text markup parsing
 *
 * Handles {term:keyword} and {ref:category:id} markup,
 * slugification, and plain-text extraction for meta tags.
 */

/**
 * Parse {term:keyword} markup into HTML spans.
 * Handles duplicate articles (e.g. "el {term:infinite}" → "El Infinito")
 * and strips parenthetical descriptions from inline display.
 */
export function parseTerms(text, glossary) {
  const articleRe = /(?:\b(el|la|los|las|del|al|the|o|a|os|as|do|da|dos|das)\s+)?\{term:([a-z0-9-]+)\}/gi;

  text = text.replace(articleRe, (match, precedingArt, keyword) => {
    const term = glossary[keyword];
    if (!term) {
      console.warn(`  ⚠ Term not found in glossary: ${keyword}`);
      return match;
    }

    const displayTitle = term.title.replace(/\s*\([^)]+\)\s*/g, '').trim();
    const makeSpan = (title) => `<span class="term" data-term="${keyword}">${title}</span>`;

    if (!precedingArt) return makeSpan(displayTitle);

    const al = precedingArt.toLowerCase();
    const titleWords = displayTitle.split(/\s+/);
    const firstWord = titleWords[0].toLowerCase();
    const stripped = titleWords.slice(1).join(' ');

    // Same article duplicated: "el El Infinito" → "El Infinito"
    if (al === firstWord) return makeSpan(displayTitle);

    // Spanish contractions: "del El Infinito" → "del Infinito"
    if ((al === 'del' || al === 'al') && firstWord === 'el')
      return precedingArt + ' ' + makeSpan(stripped);

    // Portuguese contractions
    if (al === 'do' && firstWord === 'os') return 'dos ' + makeSpan(stripped);
    if (al === 'do' && firstWord === 'as') return 'das ' + makeSpan(stripped);
    if (al === 'da' && firstWord === 'a') return 'da ' + makeSpan(stripped);
    if (['do', 'da', 'dos', 'das'].includes(al) && ['o', 'a', 'os', 'as'].includes(firstWord))
      return precedingArt + ' ' + makeSpan(stripped);

    // No duplicate → keep both
    return precedingArt + ' ' + makeSpan(displayTitle);
  });

  // Fix trailing duplicates: "<span>Véu do Esquecimento</span> do esquecimento"
  text = text.replace(/(<\/span>)\s+((?:del|do|da|of|dos|das)\s+\w+)(?=[\s.,;:!?]|$)/gi, (match, closeTag, trailing) => {
    const spanMatch = match.match(/>([^<]+)<\/span>/);
    if (!spanMatch) return match;
    const spanText = spanMatch[1];
    if (spanText.toLowerCase().endsWith(trailing.toLowerCase())) return closeTag;
    return match;
  });

  return text;
}

/**
 * Parse {ref:category:id} markup into HTML reference indicators.
 */
export function parseRefs(text) {
  return text.replace(/\{ref:([a-z]+):([a-z0-9-]+)\}/gi, (match, category, id) => {
    const refKey = `${category}:${id}`;
    return `<span class="ref" data-ref="${refKey}"></span>`;
  });
}

/**
 * Resolve terms to plain text for meta descriptions.
 * Same article deduplication and parenthetical stripping, no HTML.
 */
export function cleanTextForMeta(text, glossary) {
  const articleRe = /(?:\b(el|la|los|las|del|al|the|o|a|os|as|do|da|dos|das)\s+)?\{term:([a-z0-9-]+)\}/gi;

  text = text.replace(articleRe, (match, precedingArt, keyword) => {
    const term = glossary[keyword];
    if (!term) return precedingArt ? precedingArt + ' ' + keyword : keyword;

    const displayTitle = term.title.replace(/\s*\([^)]+\)\s*/g, '').trim();

    if (!precedingArt) return displayTitle;

    const al = precedingArt.toLowerCase();
    const titleWords = displayTitle.split(/\s+/);
    const firstWord = titleWords[0].toLowerCase();
    const stripped = titleWords.slice(1).join(' ');

    if (al === firstWord) return displayTitle;
    if ((al === 'del' || al === 'al') && firstWord === 'el') return precedingArt + ' ' + stripped;
    if (al === 'do' && firstWord === 'os') return 'dos ' + stripped;
    if (al === 'do' && firstWord === 'as') return 'das ' + stripped;
    if (al === 'da' && firstWord === 'a') return 'da ' + stripped;
    if (['do', 'da', 'dos', 'das'].includes(al) && ['o', 'a', 'os', 'as'].includes(firstWord))
      return precedingArt + ' ' + stripped;

    return precedingArt + ' ' + displayTitle;
  });

  // Remove {ref:xxx} markers
  text = text.replace(/\{ref:[^}]+\}/g, '');

  // Fix trailing duplicates
  text = text.replace(/((?:del|do|da|of|dos|das)\s+\w+)\s+\1/gi, '$1');

  return text.replace(/  +/g, ' ').trim();
}

/**
 * Generate URL-safe slug from text.
 */
export function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Process a content block's text through term and ref markup.
 * Respects feature flags — if disabled, strips markup to plain text.
 */
export function processText(text, glossary, features) {
  if (features.termMarkup) {
    text = parseTerms(text, glossary);
  } else {
    // Strip {term:keyword} to just the glossary title
    text = cleanTextForMeta(text, glossary);
  }

  if (features.refMarkup) {
    text = parseRefs(text);
  } else {
    text = text.replace(/\{ref:[^}]+\}/g, '');
  }

  return text;
}
