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

const updateThemeButton = (theme) => {
  document.querySelectorAll('.theme-toggle').forEach((btn) => {
    // ☾ in light (offers dark), ☀ in dark (offers light)
    btn.textContent = theme === 'light' ? '\u263E' : '\u2600';
  });
};

initTheme();
