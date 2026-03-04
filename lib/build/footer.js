/**
 * Footer HTML generation
 */

import { langPrefix } from './navigation.js';

/**
 * Generate footer HTML for chapter/about/glossary pages.
 */
export function generateFooter(config, ui, lang) {
  const lp = langPrefix(config, lang);
  const githubLink = config.githubRepo
    ? `\n                    <span>·</span>\n                    <a href="${config.githubRepo}" target="_blank" rel="noopener">GitHub</a>`
    : '';

  return `            <footer class="footer">
                <div class="footer-links">
                    <a href="${lp}/about.html">${ui.about}</a>
                    <span>·</span>
                    <a href="${lp}/glossary.html">${ui.glossaryPage}</a>${githubLink}
                </div>
                <div class="footer-attribution">
                    <p>${ui.footerAttribution || 'This work is a philosophical interpretation of the Ra Material, originally published by L/L Research.'}</p>
                    <p>${ui.footerSessions || 'Original sessions free at'} <a href="https://www.llresearch.org" target="_blank" rel="noopener">llresearch.org</a></p>
                    <p class="footer-copyright">&copy; ${ui.footerCopyright || 'Content derived from L/L Research material'}</p>
                </div>
            </footer>`;
}

/**
 * Generate index page footer (slightly different structure).
 */
export function generateIndexFooter(config, ui, lang) {
  const lp = langPrefix(config, lang);
  const githubLink = config.githubRepo
    ? `\n          <span>·</span>\n          <a href="${config.githubRepo}" target="_blank" rel="noopener">GitHub</a>`
    : '';

  return `      <footer class="footer-attribution">
        <div class="footer-links">
          <a href="${lp}/about.html">${ui.about}</a>
          <span>·</span>
          <a href="${lp}/glossary.html">${ui.glossaryPage}</a>${githubLink}
        </div>
        <p>${ui.footerAttribution}</p>
        <p>${ui.footerSessions} <a href="https://www.llresearch.org" target="_blank" rel="noopener">llresearch.org</a></p>
        <p class="footer-copyright">&copy; ${ui.footerCopyright}</p>
      </footer>`;
}
