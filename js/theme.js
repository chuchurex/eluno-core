/**
 * Theme — eluno.org
 * Loaded in <head> to prevent flash of wrong theme (FOUC).
 * Light = default (no data-theme attribute).
 * Dark = data-theme="dark".
 * Provides: initTheme, toggleTheme, updateThemeButton (global)
 */

const initTheme = () => {
  const saved = localStorage.getItem('theme');

  // Migration: users who had 'light' stored (old default) — clear it
  if (saved === 'light') {
    localStorage.removeItem('theme');
  }

  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    updateThemeButton('dark');
  } else {
    // Light is default — no attribute needed
    updateThemeButton('light');
  }
};

const toggleTheme = () => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const next = isDark ? 'light' : 'dark';

  if (next === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
    localStorage.removeItem('theme');
  }

  updateThemeButton(next);
};

const THEME_ICON_ATTRS =
  'width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
const THEME_ICON_MOON = `<svg ${THEME_ICON_ATTRS}><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>`;
const THEME_ICON_SUN = `<svg ${THEME_ICON_ATTRS}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`;

const updateThemeButton = (theme) => {
  document.querySelectorAll('.theme-toggle').forEach((btn) => {
    // Moon in light (offers dark), sun in dark (offers light)
    btn.innerHTML = theme === 'light' ? THEME_ICON_MOON : THEME_ICON_SUN;
  });
};

initTheme();

// theme.js runs in <head>, before the buttons exist: paint the icon once they do
document.addEventListener('DOMContentLoaded', () => {
  updateThemeButton(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
});
