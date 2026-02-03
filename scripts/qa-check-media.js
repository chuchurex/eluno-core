#!/usr/bin/env node

/**
 * QA Checker
 *
 * Comprehensive quality assurance for the build output:
 *
 * 1. MEDIA URLS: Verifies external media URLs (MP3, PDF) return HTTP 200
 * 2. LOCAL ASSETS: Verifies CSS, JS, font references point to existing files in dist/
 * 3. REDIRECTS: Detects cyclic redirects and redirect-to-nonexistent-path bugs
 * 4. LANG COHERENCE: Ensures redirect scripts don't send BASE_LANG to a subdirectory
 *
 * Usage:
 *   node packages/core/scripts/qa-check-media.js [--package <name>] [--fix-report]
 *
 * Options:
 *   --package <name>   Only check a specific package (todo, sanacion, jesus, eluno, doctrinas)
 *   --fix-report       Generate a fix-report.json with actionable repair data
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ─── Configuration ───────────────────────────────────────────────────────────

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const PACKAGES_DIR = path.join(PROJECT_ROOT, 'packages');
const PACKAGES = ['todo', 'sanacion', 'jesus', 'eluno', 'doctrinas'];

const URL_PATTERNS = [
  /https?:\/\/[^"'\s<>]+\.mp3/g,
  /https?:\/\/[^"'\s<>]+\.pdf/g,
  /https?:\/\/[^"'\s<>]+\.css[^"'\s<>]*/g,
  /https?:\/\/[^"'\s<>]+\.woff2?/g,
  /https?:\/\/[^"'\s<>]+\.jpg/g,
  /https?:\/\/[^"'\s<>]+\.png/g,
  /https?:\/\/[^"'\s<>]+\.webp/g,
];

// Also catch relative audio/pdf refs that resolve to static domain
const STATIC_URL_PATTERN = /https?:\/\/static[^"'\s<>]+/g;

// ─── CLI Args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const packageFilter = args.includes('--package') ? args[args.indexOf('--package') + 1] : null;
const generateFixReport = args.includes('--fix-report');

// ─── URL Checker ─────────────────────────────────────────────────────────────

const urlCache = new Map();
const CONCURRENT_LIMIT = 10;

function checkUrl(url) {
  if (urlCache.has(url)) return urlCache.get(url);

  const promise = new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.request(url, { method: 'HEAD', timeout: 10000 }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve({ url, status: res.statusCode, redirect: res.headers.location });
      } else {
        resolve({ url, status: res.statusCode });
      }
    });
    req.on('error', (err) => resolve({ url, status: 0, error: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ url, status: 0, error: 'timeout' }); });
    req.end();
  });

  urlCache.set(url, promise);
  return promise;
}

async function checkUrlsBatch(urls) {
  const results = [];
  for (let i = 0; i < urls.length; i += CONCURRENT_LIMIT) {
    const batch = urls.slice(i, i + CONCURRENT_LIMIT);
    const batchResults = await Promise.all(batch.map(checkUrl));
    results.push(...batchResults);
  }
  return results;
}

// ─── HTML Scanner ────────────────────────────────────────────────────────────

function findHtmlFiles(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findHtmlFiles(fullPath));
    } else if (entry.name.endsWith('.html')) {
      files.push(fullPath);
    }
  }
  return files;
}

function extractUrls(htmlContent) {
  const urls = new Set();

  for (const pattern of URL_PATTERNS) {
    const matches = htmlContent.match(pattern) || [];
    matches.forEach(u => urls.add(u.replace(/['">\s].*$/, '')));
  }

  const staticMatches = htmlContent.match(STATIC_URL_PATTERN) || [];
  staticMatches.forEach(u => {
    const clean = u.replace(/['">\s].*$/, '').replace(/["']$/, '');
    if (clean.match(/\.(mp3|pdf|css|woff2?|jpg|png|webp)/)) {
      urls.add(clean);
    }
  });

  return [...urls];
}

// ─── Local Asset Checker ────────────────────────────────────────────────────

/**
 * Extracts local asset references (CSS, JS, fonts) from HTML and verifies
 * they resolve to existing files in the dist/ directory.
 */
function checkLocalAssets(htmlContent, htmlFilePath, distDir) {
  const errors = [];

  // Match href="..." for stylesheets and src="..." for scripts
  const assetPatterns = [
    { regex: /<link[^>]+href="([^"]+\.css[^"]*)"/g, type: 'CSS' },
    { regex: /<link[^>]+href="([^"]+\.woff2?)"/g, type: 'FONT' },
    { regex: /<script[^>]+src="([^"]+\.js[^"]*)"/g, type: 'JS' },
    { regex: /url\(["']?([^"')]+\.woff2?)["']?\)/g, type: 'FONT' },
  ];

  for (const { regex, type } of assetPatterns) {
    let match;
    while ((match = regex.exec(htmlContent)) !== null) {
      let ref = match[1];

      // Skip external URLs (already checked by media URL checker)
      if (ref.startsWith('http://') || ref.startsWith('https://')) continue;
      // Skip data URIs
      if (ref.startsWith('data:')) continue;

      // Strip query string (e.g., ?v=123456)
      ref = ref.split('?')[0];

      // Resolve relative path against the HTML file's location
      let resolvedPath;
      if (ref.startsWith('/')) {
        // Absolute path from dist root
        resolvedPath = path.join(distDir, ref);
      } else {
        // Relative to the HTML file
        const htmlDir = path.dirname(htmlFilePath);
        resolvedPath = path.resolve(htmlDir, ref);
      }

      if (!fs.existsSync(resolvedPath)) {
        const relHtml = path.relative(distDir, htmlFilePath);
        errors.push({
          type,
          ref: match[1].split('?')[0],
          resolvedTo: path.relative(distDir, resolvedPath),
          source: relHtml,
        });
      }
    }
  }

  return errors;
}

// ─── Redirect Checker ───────────────────────────────────────────────────────

/**
 * Detects inline redirect scripts in HTML and checks:
 * 1. The target path exists as a directory in dist/
 * 2. The target directory contains an index.html
 * 3. No redirect to BASE_LANG subdirectory (coherence check)
 */
function checkRedirects(htmlContent, htmlFilePath, distDir, pkg) {
  const errors = [];

  // Match window.location.href = '/xx/' or window.location.href = '/xx/path'
  const redirectPattern = /window\.location\.href\s*=\s*['"]([^'"]+)['"]/g;
  let match;

  // Detect BASE_LANG from the package's .env
  const pkgDir = path.join(PACKAGES_DIR, pkg);
  const baseLang = getBaseLang(pkgDir);

  // Collect all redirect targets from this file
  const redirectTargets = [];
  while ((match = redirectPattern.exec(htmlContent)) !== null) {
    redirectTargets.push(match[1]);
  }

  if (redirectTargets.length === 0) return errors;

  const relHtml = path.relative(distDir, htmlFilePath);

  for (const target of redirectTargets) {
    // Only check relative paths (not full URLs)
    if (target.startsWith('http://') || target.startsWith('https://')) continue;

    // Check 1: Target path exists in dist/
    const targetDir = path.join(distDir, target);
    const targetIndex = target.endsWith('/')
      ? path.join(targetDir, 'index.html')
      : targetDir;

    if (!fs.existsSync(target.endsWith('/') ? targetDir : targetIndex)) {
      errors.push({
        check: 'REDIRECT_TO_MISSING',
        target,
        source: relHtml,
        detail: `Redirect target "${target}" does not exist in dist/`,
      });
    } else if (target.endsWith('/')) {
      // Directory exists, but does it have an index.html?
      const indexPath = path.join(targetDir, 'index.html');
      if (!fs.existsSync(indexPath)) {
        errors.push({
          check: 'REDIRECT_NO_INDEX',
          target,
          source: relHtml,
          detail: `Redirect target "${target}" exists but has no index.html`,
        });
      }
    }

    // Check 2: Coherence - redirect shouldn't go to BASE_LANG subdirectory
    if (baseLang) {
      const langMatch = target.match(/^\/([a-z]{2})\//);
      if (langMatch && langMatch[1] === baseLang) {
        errors.push({
          check: 'REDIRECT_TO_BASE_LANG',
          target,
          baseLang,
          source: relHtml,
          detail: `Redirect to "/${baseLang}/" but BASE_LANG=${baseLang} (content is at root)`,
        });
      }
    }
  }

  // Check 3: Cyclic redirect detection
  // If this file is inside a lang subdirectory and redirects to itself
  const htmlRelDir = path.dirname(relHtml);
  for (const target of redirectTargets) {
    if (target.startsWith('http')) continue;
    const cleanTarget = target.replace(/^\//, '').replace(/\/$/, '');
    if (cleanTarget === htmlRelDir || `${cleanTarget}/index.html` === relHtml) {
      errors.push({
        check: 'CYCLIC_REDIRECT',
        target,
        source: relHtml,
        detail: `File redirects to its own directory: "${target}" → "${relHtml}"`,
      });
    }
  }

  return errors;
}

/**
 * Detects if CSS/asset paths inside a redirect target would break.
 * For example: if /es/index.html uses relative "../css/main.css",
 * but /es/ is actually a redirect target from root, the relative path
 * resolves incorrectly.
 */
function checkRedirectAssetCoherence(distDir) {
  const errors = [];

  // Find all HTML files that have relative CSS/JS refs
  const htmlFiles = findHtmlFiles(distDir);

  for (const file of htmlFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const relPath = path.relative(distDir, file);

    // Check if this file uses relative CSS paths
    const cssRefs = content.match(/href="(\.\.[^"]*\.css[^"]*)"/g) || [];
    for (const cssRef of cssRefs) {
      const match = cssRef.match(/href="([^"]+)"/);
      if (!match) continue;
      const ref = match[1].split('?')[0];
      const resolved = path.resolve(path.dirname(file), ref);

      if (!fs.existsSync(resolved)) {
        errors.push({
          check: 'ASSET_PATH_BROKEN',
          ref: match[1].split('?')[0],
          resolvedTo: path.relative(distDir, resolved),
          source: relPath,
          detail: `Relative asset "${ref}" resolves to non-existent file`,
        });
      }
    }
  }

  return errors;
}

// ─── Utility ────────────────────────────────────────────────────────────────

function getBaseLang(pkgDir) {
  const envPath = path.join(pkgDir, '.env');
  if (!fs.existsSync(envPath)) return null;
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const match = envContent.match(/BASE_LANG=(\w+)/);
  return match ? match[1] : null;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔍 QA Checker - Comprehensive build verification\n');

  const packagesToCheck = packageFilter ? [packageFilter] : PACKAGES;
  const allResults = [];
  let hasErrors = false;

  const summary = {
    total: 0, ok: 0, broken: 0, redirect: 0,
    localAssetErrors: 0, redirectErrors: 0,
    byPackage: {}
  };

  for (const pkg of packagesToCheck) {
    const distDir = path.join(PACKAGES_DIR, pkg, 'dist');
    if (!fs.existsSync(distDir)) {
      console.log(`⏭️  ${pkg}: No dist/ directory (skipping)\n`);
      continue;
    }

    console.log(`📦 ${pkg}`);
    const htmlFiles = findHtmlFiles(distDir);
    console.log(`   ${htmlFiles.length} HTML files found`);

    // ── Check 1: External Media URLs ──
    const urlsWithSources = new Map();
    for (const file of htmlFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const urls = extractUrls(content);
      for (const url of urls) {
        if (!urlsWithSources.has(url)) urlsWithSources.set(url, []);
        const relPath = path.relative(distDir, file);
        if (!urlsWithSources.get(url).includes(relPath)) {
          urlsWithSources.get(url).push(relPath);
        }
      }
    }

    const uniqueUrls = [...urlsWithSources.keys()];
    console.log(`   ${uniqueUrls.length} unique media URLs to check`);

    const results = await checkUrlsBatch(uniqueUrls);

    const pkgSummary = { ok: 0, broken: [], redirect: [], localAssetErrors: [], redirectErrors: [] };

    for (const result of results) {
      summary.total++;
      if (result.status === 200) {
        pkgSummary.ok++;
        summary.ok++;
      } else if (result.status >= 300 && result.status < 400) {
        pkgSummary.redirect.push(result);
        summary.redirect++;
      } else {
        pkgSummary.broken.push({
          ...result,
          sources: urlsWithSources.get(result.url),
        });
        summary.broken++;
      }
    }

    // Print media URL results
    if (pkgSummary.broken.length > 0) {
      console.log(`   ❌ ${pkgSummary.broken.length} BROKEN URLs:`);
      for (const b of pkgSummary.broken) {
        const ext = path.extname(b.url).replace('.', '').toUpperCase();
        console.log(`      [${ext}] ${b.status || 'ERR'} ${b.url}`);
        if (b.error) console.log(`           Error: ${b.error}`);
        console.log(`           Referenced in: ${b.sources.slice(0, 3).join(', ')}${b.sources.length > 3 ? ` (+${b.sources.length - 3} more)` : ''}`);
      }
    }
    if (pkgSummary.redirect.length > 0) {
      console.log(`   ⚠️  ${pkgSummary.redirect.length} redirects:`);
      for (const r of pkgSummary.redirect) {
        console.log(`      ${r.status} ${r.url} → ${r.redirect}`);
      }
    }
    if (uniqueUrls.length > 0) {
      console.log(`   ✅ ${pkgSummary.ok} URLs OK`);
    }

    // ── Check 2: Local Assets ──
    console.log(`   ── Local Assets ──`);
    let localAssetErrors = [];
    for (const file of htmlFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const errors = checkLocalAssets(content, file, distDir);
      localAssetErrors.push(...errors);
    }

    // Deduplicate by ref+resolvedTo (same missing asset from multiple pages)
    const uniqueAssetErrors = [];
    const seenAssets = new Set();
    for (const err of localAssetErrors) {
      const key = `${err.type}:${err.resolvedTo}`;
      if (!seenAssets.has(key)) {
        seenAssets.add(key);
        // Collect all sources for this same missing asset
        err.allSources = localAssetErrors
          .filter(e => `${e.type}:${e.resolvedTo}` === key)
          .map(e => e.source);
        uniqueAssetErrors.push(err);
      }
    }

    if (uniqueAssetErrors.length > 0) {
      console.log(`   ❌ ${uniqueAssetErrors.length} missing local assets:`);
      for (const e of uniqueAssetErrors) {
        console.log(`      [${e.type}] "${e.ref}" → ${e.resolvedTo}`);
        console.log(`           Referenced in: ${e.allSources.slice(0, 3).join(', ')}${e.allSources.length > 3 ? ` (+${e.allSources.length - 3} more)` : ''}`);
      }
      pkgSummary.localAssetErrors = uniqueAssetErrors;
      summary.localAssetErrors += uniqueAssetErrors.length;
    } else {
      console.log(`   ✅ All local assets resolved`);
    }

    // ── Check 3: Redirects & Coherence ──
    console.log(`   ── Redirects & Coherence ──`);
    let redirectErrors = [];
    for (const file of htmlFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const errors = checkRedirects(content, file, distDir, pkg);
      redirectErrors.push(...errors);
    }

    // Also check asset coherence across the whole dist
    const assetCoherenceErrors = checkRedirectAssetCoherence(distDir);
    redirectErrors.push(...assetCoherenceErrors);

    if (redirectErrors.length > 0) {
      console.log(`   ❌ ${redirectErrors.length} redirect/coherence issues:`);
      for (const e of redirectErrors) {
        const icon = e.check === 'CYCLIC_REDIRECT' ? '🔄' :
                     e.check === 'REDIRECT_TO_BASE_LANG' ? '🌐' :
                     e.check === 'ASSET_PATH_BROKEN' ? '📁' : '🔗';
        console.log(`      ${icon} [${e.check}] ${e.detail}`);
        console.log(`           Source: ${e.source}`);
      }
      pkgSummary.redirectErrors = redirectErrors;
      summary.redirectErrors += redirectErrors.length;
    } else {
      console.log(`   ✅ No redirect or coherence issues`);
    }

    console.log('');

    summary.byPackage[pkg] = pkgSummary;
    allResults.push(...pkgSummary.broken.map(b => ({ package: pkg, ...b })));

    if (pkgSummary.broken.length > 0 || uniqueAssetErrors.length > 0 || redirectErrors.length > 0) {
      hasErrors = true;
    }
  }

  // Final summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`📊 SUMMARY`);
  console.log(`   Media URLs: ${summary.total} checked (✅ ${summary.ok} OK, ❌ ${summary.broken} broken, ⚠️  ${summary.redirect} redirects)`);
  console.log(`   Local Assets: ${summary.localAssetErrors === 0 ? '✅' : '❌'} ${summary.localAssetErrors} missing`);
  console.log(`   Redirects: ${summary.redirectErrors === 0 ? '✅' : '❌'} ${summary.redirectErrors} issues`);
  console.log('═══════════════════════════════════════════════════════════');

  // Generate fix report
  if (generateFixReport && hasErrors) {
    const reportPath = path.join(PROJECT_ROOT, 'qa-fix-report.json');
    const report = {
      generated: new Date().toISOString(),
      summary: {
        totalBroken: allResults.length,
        localAssetErrors: summary.localAssetErrors,
        redirectErrors: summary.redirectErrors,
        byType: {},
        byPackage: {},
      },
      broken: allResults.map(r => ({
        package: r.package,
        url: r.url,
        status: r.status,
        error: r.error || null,
        type: path.extname(r.url).replace('.', ''),
        sources: r.sources,
      })),
      localAssets: Object.entries(summary.byPackage)
        .flatMap(([pkg, s]) => (s.localAssetErrors || []).map(e => ({ package: pkg, ...e }))),
      redirectIssues: Object.entries(summary.byPackage)
        .flatMap(([pkg, s]) => (s.redirectErrors || []).map(e => ({ package: pkg, ...e }))),
    };

    // Group by type
    for (const r of report.broken) {
      report.summary.byType[r.type] = (report.summary.byType[r.type] || 0) + 1;
      report.summary.byPackage[r.package] = (report.summary.byPackage[r.package] || 0) + 1;
    }

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📝 Fix report saved to: qa-fix-report.json`);
  }

  // Exit with error code if any issues found
  if (hasErrors) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(2);
});
