/**
 * eluno.js — Main application logic
 * Handles: panels, chapter nav, audio, glossary terms, scroll-spy
 * Theme is handled separately by theme.js (loaded in <head>)
 */

// ── Panels (sidebar, notes, overlay) ─────────────────────────

const toggleNav = () => {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  const notes = document.getElementById('notes');
  sidebar.classList.toggle('open');
  overlay.classList.toggle('active');
  if (notes) notes.classList.remove('open');

  const navBtn = document.querySelector('.nav-toggle');
  const notesBtn = document.querySelector('.notes-toggle');
  const isOpen = sidebar.classList.contains('open');
  if (navBtn) navBtn.setAttribute('aria-expanded', isOpen);
  if (notesBtn) notesBtn.setAttribute('aria-expanded', 'false');
  if (isOpen) {
    const first = sidebar.querySelector('a');
    if (first) first.focus();
  }
};

const toggleNotes = () => {
  const notes = document.getElementById('notes');
  const overlay = document.getElementById('overlay');
  const sidebar = document.getElementById('sidebar');
  notes.classList.toggle('open');
  overlay.classList.toggle('active');
  sidebar.classList.remove('open');

  const navBtn = document.querySelector('.nav-toggle');
  const notesBtn = document.querySelector('.notes-toggle');
  const isOpen = notes.classList.contains('open');
  if (notesBtn) notesBtn.setAttribute('aria-expanded', isOpen);
  if (navBtn) navBtn.setAttribute('aria-expanded', 'false');
  if (isOpen) {
    const first = notes.querySelector('a, button');
    if (first) first.focus();
  }
};

const closeAll = () => {
  document.getElementById('sidebar').classList.remove('open');
  const notes = document.getElementById('notes');
  if (notes) notes.classList.remove('open');
  document.getElementById('overlay').classList.remove('active');

  const navBtn = document.querySelector('.nav-toggle');
  const notesBtn = document.querySelector('.notes-toggle');
  if (navBtn) navBtn.setAttribute('aria-expanded', 'false');
  if (notesBtn) notesBtn.setAttribute('aria-expanded', 'false');
};

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeAll();
});

// ── Chapter nav (expand/collapse sections) ───────────────────

const toggleChapter = (id) => {
  const group = document.getElementById('nav-group-' + id);
  if (!group) return;
  group.classList.toggle('expanded');
  const btn = group.querySelector('.nav-chapter-toggle');
  if (btn) btn.setAttribute('aria-expanded', group.classList.contains('expanded'));
};

// ── Audio player ─────────────────────────────────────────────

const toggleAudio = (num) => {
  const panel = document.getElementById('audio-panel-' + num);
  const btn = document.querySelector('[data-audio-btn="' + num + '"]');
  if (!panel) return;

  // Close other audio panels
  document.querySelectorAll('.ch-media-audio-panel').forEach((p) => {
    if (p.id !== 'audio-panel-' + num) {
      p.classList.remove('active');
      const a = p.querySelector('audio');
      if (a) a.pause();
    }
  });
  document.querySelectorAll('[data-audio-btn]').forEach((b) => b.classList.remove('active'));

  panel.classList.toggle('active');
  const audio = panel.querySelector('audio');
  if (panel.classList.contains('active')) {
    if (btn) btn.classList.add('active');
    if (audio && audio.paused) audio.play().catch(() => {});
  } else {
    if (audio) audio.pause();
  }
};

// ── Event delegation ─────────────────────────────────────────
// Replaces inline onclick="" handlers in the HTML.
// HTML uses data-action="action-name" attributes instead.

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;

  const action = el.dataset.action;

  switch (action) {
    case 'toggle-nav':
      toggleNav();
      break;
    case 'toggle-notes':
      toggleNotes();
      break;
    case 'toggle-theme':
      toggleTheme(); // defined in theme.js
      break;
    case 'close-all':
      closeAll();
      break;
    case 'toggle-chapter':
      toggleChapter(el.dataset.chapter);
      break;
    case 'toggle-audio':
      toggleAudio(el.dataset.audio);
      break;
    case 'nav-link-close':
      if (window.innerWidth <= 1100) closeAll();
      break;
  }
});

// ── Terms → Notes panel ──────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.term').forEach((t) => {
    t.addEventListener('click', function (e) {
      e.preventDefault();
      const noteId = 'note-' + this.dataset.term;
      const note = document.getElementById(noteId);
      if (!note) return;

      // Deactivate all, activate clicked
      document.querySelectorAll('.term').forEach((x) => x.classList.remove('active'));
      document.querySelectorAll('.note').forEach((n) => n.classList.remove('active'));
      const empty = document.getElementById('notes-term-empty');
      if (empty) empty.style.display = 'none';

      this.classList.add('active');
      note.classList.add('active');

      // On mobile, open notes panel
      if (window.innerWidth <= 1100) {
        document.getElementById('notes').classList.add('open');
        document.getElementById('overlay').classList.add('active');
      }
      note.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  });

  // ── Scroll-spy & contextual sidebar ──────────────────────

  const sections = document.querySelectorAll('.section[id]');
  const contextTitle = document.getElementById('notes-context-title');
  const sourcesEmpty = document.getElementById('notes-sources-empty');
  const allSourceBlocks = document.querySelectorAll('.notes-sources[data-section]');
  let currentSectionId = null;

  const updateSidebarContext = (sectionId) => {
    if (sectionId === currentSectionId) return;
    currentSectionId = sectionId;
    const sectionEl = document.getElementById(sectionId);
    if (!sectionEl) return;

    const title = sectionEl.getAttribute('data-section-title') || '';
    const num = sectionEl.getAttribute('data-section-number') || '';

    // Fade transition
    contextTitle.style.opacity = '0';
    setTimeout(() => {
      contextTitle.textContent = num + ' ' + title;
      contextTitle.style.opacity = '1';
    }, 150);

    // Show matching sources, hide others
    let hasSource = false;
    allSourceBlocks.forEach((block) => {
      if (block.getAttribute('data-section') === sectionId) {
        block.style.display = 'block';
        hasSource = true;
      } else {
        block.style.display = 'none';
      }
    });
    if (sourcesEmpty) {
      sourcesEmpty.style.display = hasSource ? 'none' : 'block';
    }

    // Highlight active section in left nav
    document.querySelectorAll('.nav-link.sub').forEach((link) => {
      link.classList.toggle('current', link.getAttribute('href') === '#' + sectionId);
    });
  };

  // IntersectionObserver for scroll-spy
  if ('IntersectionObserver' in window && sections.length > 0) {
    const observer = new IntersectionObserver(
      (entries) => {
        let topEntry = null;
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (!topEntry || entry.boundingClientRect.top < topEntry.boundingClientRect.top) {
              topEntry = entry;
            }
          }
        });
        if (topEntry) updateSidebarContext(topEntry.target.id);
      },
      { rootMargin: '-10% 0px -60% 0px', threshold: 0 },
    );
    sections.forEach((section) => observer.observe(section));
  }

  // Section context button
  document.querySelectorAll('.sec-context-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = btn.getAttribute('data-target');
      updateSidebarContext(targetId);
      if (window.innerWidth <= 1100) {
        document.getElementById('notes').classList.add('open');
        document.getElementById('overlay').classList.add('active');
        document.getElementById('sidebar').classList.remove('open');
      }
    });
  });
});
