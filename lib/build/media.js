/**
 * Media URL resolution
 *
 * Rewrites root-relative media paths (e.g. "/audiobook/x.mp3") to absolute
 * URLs on the static asset subdomain when staticBaseUrl is configured.
 *
 * Behavior:
 *   - Falsy path                -> ''
 *   - Already absolute (http/s) -> path unchanged
 *   - No staticBaseUrl          -> path unchanged (dev-local serving)
 *   - Otherwise                 -> staticBaseUrl + path
 */

export function resolveMediaUrl(path, config) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  if (!config.staticBaseUrl) return path;

  const base = config.staticBaseUrl.replace(/\/+$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}
