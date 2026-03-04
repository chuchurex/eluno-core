/**
 * Asset management — copy JS, fonts, static files
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * Ensure directory exists (recursive).
 */
export function ensureDir(dirPath) {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Copy directory recursively.
 */
export function copyDirRecursive(src, dest) {
  if (!existsSync(src)) return;
  ensureDir(dest);
  const entries = readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      ensureDir(destPath);
      copyDirRecursive(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Copy JS files from core to dist/js/.
 * Consumer can override by placing files in their own src/js/.
 */
export function copyJsFiles(config) {
  const coreJsDir = join(config.coreRoot, 'js');
  const consumerJsDir = join(config.projectRoot, 'src', 'js');
  const distJsDir = join(config.outputDir, 'js');
  ensureDir(distJsDir);

  const files = ['theme.js', 'eluno.js', 'search.js', 'glossary-page.js'];

  for (const file of files) {
    // Consumer override takes priority
    const consumerPath = join(consumerJsDir, file);
    const corePath = join(coreJsDir, file);

    if (existsSync(consumerPath)) {
      copyFileSync(consumerPath, join(distJsDir, file));
      console.log(`  ✓ js/${file} (project)`);
    } else if (existsSync(corePath)) {
      copyFileSync(corePath, join(distJsDir, file));
      console.log(`  ✓ js/${file} (core)`);
    }
  }
}

/**
 * Copy fonts from core to dist/fonts/.
 * Consumer can override by placing files in their own src/fonts/.
 */
export function copyFonts(config) {
  const coreFontsDir = join(config.coreRoot, 'fonts');
  const consumerFontsDir = join(config.projectRoot, 'src', 'fonts');
  const distFontsDir = join(config.outputDir, 'fonts');
  ensureDir(distFontsDir);

  // Determine source (consumer override or core)
  const srcDir = existsSync(consumerFontsDir) ? consumerFontsDir : coreFontsDir;
  const label = existsSync(consumerFontsDir) ? 'project' : 'core';

  if (existsSync(srcDir)) {
    readdirSync(srcDir).forEach(file => {
      copyFileSync(join(srcDir, file), join(distFontsDir, file));
    });
    console.log(`  ✅ fonts/ (${label})`);
  }
}

/**
 * Generate root index.html with language detection.
 */
export function generateRootIndex(config) {
  const baseLangIndexPath = join(config.outputDir, config.baseLang, 'index.html');
  if (!existsSync(baseLangIndexPath)) return;

  let rootHtml = readFileSync(baseLangIndexPath, 'utf8');

  // Build language detection alternatives
  const otherLangs = config.languages.filter(l => l !== config.baseLang);
  if (otherLangs.length > 0) {
    const langChecks = otherLangs
      .map(l => `if(c==='${l}')`)
      .join('||');
    const langArray = otherLangs.map(l => `'${l}'`).join(',');

    const langDetectScript = `<script>(function(){var s=localStorage.getItem('lang');if(s&&s!=='${config.baseLang}'&&[${langArray}].indexOf(s)!==-1){location.replace('/'+s+'/');return}if(!s){var l=(navigator.languages||[navigator.language]);for(var i=0;i<l.length;i++){var c=l[i].substring(0,2).toLowerCase();${langChecks}{localStorage.setItem('lang',c);location.replace('/'+c+'/');return}if(c==='${config.baseLang}')break}localStorage.setItem('lang','${config.baseLang}')}})()</script>`;
    rootHtml = rootHtml.replace('<head>', '<head>\n' + langDetectScript);
  }

  const rootIndexPath = join(config.outputDir, 'index.html');
  writeFileSync(rootIndexPath, rootHtml);
  console.log(`  ✅ index.html (root, ${config.baseLang.toUpperCase()} + lang detection)`);
}

/**
 * Copy static files from consumer's static/ directory.
 */
export function copyStaticFiles(config) {
  const staticDir = join(config.projectRoot, 'static');
  if (existsSync(staticDir)) {
    copyDirRecursive(staticDir, config.outputDir);
    console.log('  ✅ static/');
  }
}
