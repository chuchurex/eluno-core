/**
 * Sitemap and robots.txt generation
 */

import { writeFileSync } from 'fs';
import { join } from 'path';

/**
 * Generate sitemap.xml with hreflang alternates.
 */
export function generateSitemap(config, chapterSlugMap) {
  const today = new Date().toISOString().split('T')[0];
  const enabledChapters = config.enabledChapters || Object.keys(chapterSlugMap[config.baseLang] || {}).map(Number);

  let urls = '';

  // Helper: build URL for a lang
  function langPrefix(lang) {
    if (!config.baseLangPrefix && lang === config.baseLang) return '';
    return `/${lang}`;
  }

  // Index pages
  for (const lang of config.languages) {
    const loc = `${config.siteUrl}${langPrefix(lang)}/`;
    const alternates = config.languages
      .map(l => `    <xhtml:link rel="alternate" hreflang="${l}" href="${config.siteUrl}${langPrefix(l)}/"/>`)
      .join('\n');
    urls += `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>1.0</priority>\n${alternates}\n  </url>\n`;
  }

  // About pages
  for (const lang of config.languages) {
    const loc = `${config.siteUrl}${langPrefix(lang)}/about.html`;
    const alternates = config.languages
      .map(l => `    <xhtml:link rel="alternate" hreflang="${l}" href="${config.siteUrl}${langPrefix(l)}/about.html"/>`)
      .join('\n');
    urls += `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.5</priority>\n${alternates}\n  </url>\n`;
  }

  // Glossary pages (only if feature enabled)
  if (config.features.glossary) {
    for (const lang of config.languages) {
      const loc = `${config.siteUrl}${langPrefix(lang)}/glossary.html`;
      const alternates = config.languages
        .map(l => `    <xhtml:link rel="alternate" hreflang="${l}" href="${config.siteUrl}${langPrefix(l)}/glossary.html"/>`)
        .join('\n');
      urls += `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n${alternates}\n  </url>\n`;
    }
  }

  // Chapter pages
  for (const chNum of enabledChapters) {
    for (const lang of config.languages) {
      const slug = chapterSlugMap[lang]?.[chNum];
      if (!slug) continue;

      let loc;
      if (config.chapterUrlPattern === 'numeric') {
        loc = `${config.siteUrl}${langPrefix(lang)}/ch${slug}/index.html`;
      } else {
        loc = `${config.siteUrl}/${lang}/chapters/${slug}.html`;
      }

      const alternates = config.languages
        .filter(l => chapterSlugMap[l]?.[chNum])
        .map(l => {
          const s = chapterSlugMap[l][chNum];
          let href;
          if (config.chapterUrlPattern === 'numeric') {
            href = `${config.siteUrl}${langPrefix(l)}/ch${s}/index.html`;
          } else {
            href = `${config.siteUrl}/${l}/chapters/${s}.html`;
          }
          return `    <xhtml:link rel="alternate" hreflang="${l}" href="${href}"/>`;
        })
        .join('\n');
      urls += `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n${alternates}\n  </url>\n`;
    }
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}</urlset>`;

  const outPath = join(config.outputDir, 'sitemap.xml');
  writeFileSync(outPath, sitemap, 'utf-8');
  const urlCount = (sitemap.match(/<url>/g) || []).length;
  console.log(`  ✅ sitemap.xml (${urlCount} URLs)`);
}

/**
 * Generate robots.txt.
 */
export function generateRobotsTxt(config) {
  const content = `User-agent: *
Allow: /

Sitemap: ${config.siteUrl}/sitemap.xml
`;
  const outPath = join(config.outputDir, 'robots.txt');
  writeFileSync(outPath, content, 'utf-8');
  console.log('  ✅ robots.txt');
}
