/**
 * HTML <head> generation — shared across all page types
 */

/**
 * Google Analytics preconnect links (empty string if no GA ID).
 */
export function gaPreconnect(config) {
  if (!config.gaId) return '';
  return `<link rel="dns-prefetch" href="https://www.googletagmanager.com">
    <link rel="preconnect" href="https://www.googletagmanager.com" crossorigin>`;
}

/**
 * Google Analytics script tag (empty string if no GA ID).
 */
export function gaScript(config) {
  if (!config.gaId) return '';
  return `<!-- Google tag (gtag.js) — deferred -->
    <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${config.gaId}');
    window.addEventListener('load',function(){var s=document.createElement('script');s.src='https://www.googletagmanager.com/gtag/js?id=${config.gaId}';s.async=true;document.head.appendChild(s)});</script>`;
}

/**
 * Generate hreflang alternate link tags.
 */
function hreflangLinks(config, urlBuilder) {
  return config.languages
    .map(l => `<link rel="alternate" hreflang="${l}" href="${urlBuilder(l)}">`)
    .join('\n    ');
}

/**
 * Generate font preload and stylesheet links.
 */
function fontLinks(config) {
  return `<link rel="preload" href="/fonts/cormorant-garamond-400.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="/fonts/spectral-400.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="stylesheet" href="/fonts/fonts.css?v=${config.buildHash}">
    <link rel="stylesheet" href="/css/main.css?v=${config.buildHash}">`;
}

/**
 * Generate the full <head> section.
 *
 * @param {object} config - Resolved config
 * @param {object} opts - Page-specific options
 * @param {string} opts.title - Page title
 * @param {string} opts.description - Meta description
 * @param {string} opts.canonicalUrl - Canonical URL
 * @param {string} opts.lang - Page language
 * @param {string} opts.ogType - OpenGraph type (article, book, website)
 * @param {function} opts.hreflangUrlBuilder - Function(lang) → URL for each language
 * @param {string} [opts.extraHead] - Extra HTML to inject in <head>
 */
export function generateHead(config, opts) {
  return `<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${opts.title}</title>
    <meta name="description" content="${opts.description}">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="${opts.canonicalUrl}">

    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    ${gaPreconnect(config)}

    <!-- OpenGraph -->
    <meta property="og:title" content="${opts.title}">
    <meta property="og:description" content="${opts.description}">
    <meta property="og:type" content="${opts.ogType || 'website'}">
    <meta property="og:url" content="${opts.canonicalUrl}">
    <meta property="og:locale" content="${opts.lang}">

    <!-- Alternate languages -->
    ${hreflangLinks(config, opts.hreflangUrlBuilder)}

    ${fontLinks(config)}

    ${gaScript(config)}
    <script src="/js/theme.js?v=${config.buildHash}"></script>${opts.extraHead || ''}
</head>`;
}
