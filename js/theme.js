/**
 * Theme — eluno.org
 * Loaded in <head> to prevent flash of wrong theme (FOUC).
 * Provides: initTheme, toggleTheme, updateThemeButton (global)
 */

const initTheme = () => {
  const saved = localStorage.getItem('theme');
  if (saved === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    updateThemeButton('light');
  } else {
    updateThemeButton('dark');
  }
};

const toggleTheme = () => {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const next = isLight ? 'dark' : 'light';
  if (next === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  localStorage.setItem('theme', next);
  updateThemeButton(next);
};

const updateThemeButton = (theme) => {
  document.querySelectorAll('.theme-toggle').forEach((btn) => {
    btn.textContent = theme === 'light' ? '\u263E' : '\u2600';
  });
};

initTheme();
