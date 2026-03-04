/**
 * Search — eluno.org
 * Loaded on pages with a search bar (landing, glossary).
 * Reads labels from data attributes on #search-wrap:
 *   data-no-results, data-label-chapter, data-label-glossary
 */

(function () {
  let searchIndex = null;
  const input = document.getElementById('site-search');
  const results = document.getElementById('search-results');
  if (!input || !results) return;

  // Read localized labels from HTML (injected by build)
  const wrap = document.getElementById('search-wrap');
  const labels = {
    noResults: wrap?.dataset.noResults || 'No results found',
    chapter: wrap?.dataset.labelChapter || 'Chapter',
    glossary: wrap?.dataset.labelGlossary || 'Glossary',
  };

  let debounceTimer;
  input.addEventListener('input', function () {
    clearTimeout(debounceTimer);
    const self = this;
    debounceTimer = setTimeout(() => doSearch(self.value), 200);
  });

  // Close on click outside
  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !results.contains(e.target)) {
      results.hidden = true;
    }
  });
  input.addEventListener('focus', () => {
    if (results.children.length > 0) results.hidden = false;
  });

  // Normalize: lowercase + strip accents
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const escapeRe = (s) => s.replace(/[-.*+?^$|()[\]\\]/g, '\\$&');

  // Word-boundary match
  const wordMatch = (text, queryWords) => {
    const n = norm(text);
    const sep = '[^a-z0-9\u00e0-\u00ff]';
    return queryWords.every((w) => {
      const re = new RegExp('(^|' + sep + ')' + escapeRe(w) + '(' + sep + '|$)');
      return re.test(n);
    });
  };

  const doSearch = (value) => {
    const query = value.trim();
    if (query.length < 2) {
      results.hidden = true;
      results.innerHTML = '';
      return;
    }

    if (!searchIndex) {
      const lang = document.documentElement.lang || 'en';
      fetch('/' + lang + '/search-index.json')
        .then((r) => r.json())
        .then((data) => {
          searchIndex = data;
          renderResults(query);
        });
      return;
    }
    renderResults(query);
  };

  const renderResults = (query) => {
    const queryWords = norm(query)
      .split(/\s+/)
      .filter((w) => w.length > 0);
    const matches = searchIndex
      .filter((item) => wordMatch(item.title, queryWords) || wordMatch(item.text, queryWords))
      .slice(0, 10);

    if (matches.length === 0) {
      results.innerHTML = '<div class="search-no-results">' + labels.noResults + '</div>';
      results.hidden = false;
      return;
    }

    const typeLabels = { chapter: labels.chapter, section: labels.chapter, glossary: labels.glossary };
    results.innerHTML = matches
      .map(
        (m) =>
          '<a class="search-result" href="' +
          m.url +
          '">' +
          '<div class="search-result-type">' +
          (typeLabels[m.type] || m.type) +
          '</div>' +
          '<div class="search-result-title">' +
          m.title +
          '</div>' +
          '<div class="search-result-text">' +
          m.text.substring(0, 100) +
          '</div>' +
          '</a>',
      )
      .join('');
    results.hidden = false;
  };
})();
