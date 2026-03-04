/**
 * Glossary Page — eluno.org
 * Loaded only on /{lang}/glossary.html
 * Handles: A-Z / Categories view toggle, live filter, hash navigation
 */

(function () {
  const azView = document.querySelector('.glossary-view-az');
  const catView = document.querySelector('.glossary-view-cat');
  const viewBtns = document.querySelectorAll('.glossary-view-btn');

  // ── View toggle (A-Z / Categories) ──────────────────────

  const setView = (mode) => {
    const isAz = mode === 'az';
    if (azView) azView.style.display = isAz ? '' : 'none';
    if (catView) catView.style.display = isAz ? 'none' : '';
    viewBtns.forEach((btn) => {
      const active = btn.getAttribute('data-view') === mode;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    // Clear filter when switching views
    const input = document.getElementById('glossary-filter');
    if (input && input.value) {
      input.value = '';
      filterEntries('');
    }
  };

  viewBtns.forEach((btn) => {
    btn.addEventListener('click', () => setView(btn.getAttribute('data-view')));
  });

  // ── Category tag click ──────────────────────────────────

  document.querySelectorAll('.glossary-cat-tag').forEach((tag) => {
    const go = () => {
      const cat = tag.getAttribute('data-cat');
      setView('categories');
      const target = document.getElementById('cat-' + cat);
      if (target) setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    };
    tag.addEventListener('click', go);
    tag.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        go();
      }
    });
  });

  // ── Live filter ─────────────────────────────────────────

  const filterEntries = (query) => {
    const active = document.querySelector('.glossary-view:not([style*="display: none"])');
    if (!active) return;

    active.querySelectorAll('.glossary-entry').forEach((entry) => {
      const title = entry.querySelector('.glossary-term-title').textContent.toLowerCase();
      const content = entry.textContent.toLowerCase();
      entry.style.display = query === '' || title.includes(query) || content.includes(query) ? '' : 'none';
    });

    // Hide empty sections
    active.querySelectorAll('.glossary-letter, .glossary-category').forEach((section) => {
      const visible = section.querySelectorAll('.glossary-entry:not([style*="display: none"])');
      section.style.display = visible.length > 0 ? '' : 'none';
    });
  };

  const input = document.getElementById('glossary-filter');
  if (input) {
    input.addEventListener('input', () => filterEntries(input.value.toLowerCase().trim()));
  }

  // ── Hash navigation ─────────────────────────────────────

  const handleHash = () => {
    const hash = window.location.hash.substring(1);
    if (!hash) return;

    // Category deep link
    if (hash.startsWith('cat-')) {
      setView('categories');
      const ct = document.getElementById(hash);
      if (ct) setTimeout(() => ct.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
      return;
    }

    // Letter deep link
    if (hash.startsWith('letter-')) setView('az');

    // Term deep link with highlight
    const target = document.getElementById(hash) || document.getElementById('term-' + hash);
    if (target) {
      setView('az');
      setTimeout(() => {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const entry = target.closest('.glossary-entry') || target;
        entry.style.outline = '2px solid var(--gold)';
        entry.style.outlineOffset = '4px';
        setTimeout(() => {
          entry.style.outline = '';
          entry.style.outlineOffset = '';
        }, 2500);
      }, 50);
    }
  };

  handleHash();
  window.addEventListener('hashchange', handleHash);
})();
