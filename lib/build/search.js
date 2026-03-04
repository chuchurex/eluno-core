/**
 * Search index generation (opt-in via features.search)
 */

import { slugify } from './content.js';
import { langPrefix, chapterUrl } from './navigation.js';

/**
 * Generate search index JSON for a language.
 * Returns an array of indexable entries (chapters, sections, glossary terms).
 */
export function generateSearchIndex(config, lang, chapters, glossary, glossaryMeta) {
  const index = [];
  const lp = langPrefix(config, lang);

  // Index chapters by section
  for (const chapter of chapters) {
    const chUrl = chapterUrl(config, lang, chapter);

    // Chapter-level entry
    const firstText = chapter.sections[0]?.content[0]?.text || '';
    const cleanFirst = firstText.replace(/<[^>]*>/g, '').replace(/\{[^}]+\}/g, '').substring(0, 200);
    index.push({
      type: 'chapter',
      title: `${chapter.numberText}: ${chapter.title}`,
      text: cleanFirst,
      url: chUrl
    });

    // Section-level entries
    for (const section of chapter.sections) {
      const sectionText = section.content
        .filter(b => b.type === 'paragraph')
        .map(b => b.text.replace(/<[^>]*>/g, '').replace(/\{[^}]+\}/g, ''))
        .join(' ')
        .substring(0, 200);
      index.push({
        type: 'section',
        title: `${chapter.numberText} — ${section.title}`,
        text: sectionText,
        url: `${chUrl}#${section.id}`
      });
    }
  }

  // Index glossary terms
  if (config.features.glossary) {
    const sorted = Object.entries(glossary).sort((a, b) =>
      a[1].title.localeCompare(b[1].title, lang)
    );
    const numberMap = {};
    const letterCount = {};
    for (const [key, term] of sorted) {
      const letter = term.title.charAt(0).toUpperCase();
      letterCount[letter] = (letterCount[letter] || 0) + 1;
      numberMap[key] = `${letter}.${letterCount[letter]}`;
    }

    const termCategories = glossaryMeta ? glossaryMeta.terms || {} : {};
    const categoryDefs = glossaryMeta ? glossaryMeta.categories || {} : {};

    for (const [key, term] of sorted) {
      const contentText = Array.isArray(term.content)
        ? term.content.join(' ').substring(0, 200)
        : String(term.content).substring(0, 200);
      const num = numberMap[key];
      const anchor = num.toLowerCase().replace('.', '-');
      const catKey = termCategories[key];
      const category = catKey && categoryDefs[catKey]
        ? categoryDefs[catKey][lang] || categoryDefs[catKey].en || ''
        : '';
      index.push({
        type: 'glossary',
        title: `${num} ${term.title}`,
        text: contentText,
        url: `${lp}/glossary.html#${anchor}`,
        category
      });
    }
  }

  return index;
}
