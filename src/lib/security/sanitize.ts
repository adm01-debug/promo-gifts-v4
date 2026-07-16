/**
 * URL Sanitizer — XSS Prevention
 *
 * Blocks javascript:, data:, vbscript: and other dangerous URI schemes.
 * PhD-level defense: multiple layers, no regex-only approach.
 *
 * Based on OWASP XSS Prevention Cheat Sheet:
 * https://owasp.org/www-community/attacks/xss/
 */

const SAFE_URL_PROTOCOLS = new Set(['https:', 'http:']);
const DANGEROUS_PROTOCOLS = /^(javascript|data|vbscript|file|blob):/i;

/**
 * sanitizeUrl — validate and sanitize a URL string.
 *
 * @param url - Raw URL input from user
 * @param options - Strictness options
 * @returns Safe URL string, or null if dangerous
 */
export function sanitizeUrl(
  url: string | null | undefined,
  options: { httpsOnly?: boolean; allowEmpty?: boolean } = {},
): string | null {
  if (!url) {
    return options.allowEmpty ? '' : null;
  }

  const trimmed = url.trim();
  if (!trimmed) return null;

  // Quick check: reject javascript: and other dangerous schemes upfront
  if (DANGEROUS_PROTOCOLS.test(trimmed)) {
    console.warn('[SecurityGuard] Blocked dangerous URL scheme:', trimmed.slice(0, 30));
    return null;
  }

  // Parse URL to validate structure
  try {
    const parsed = new URL(trimmed);
    const protocol = parsed.protocol.toLowerCase();

    // Strict mode: https:// only (production images should be on CDN)
    if (options.httpsOnly && protocol !== 'https:') {
      return null;
    }

    // General mode: allow http and https only
    if (!SAFE_URL_PROTOCOLS.has(protocol)) {
      console.warn('[SecurityGuard] Blocked non-http(s) URL scheme:', protocol);
      return null;
    }

    return parsed.toString();
  } catch {
    // URL is malformed (e.g. "not-a-url" without a scheme)
    // Return null: malformed URLs in src/href attributes are a footgun
    return null;
  }
}

/**
 * sanitizeText — strip HTML tags from user-provided text.
 * Prevents XSS when text is inserted into DOM via innerHTML.
 * NOTE: React's JSX escapes text automatically, so this is only needed
 * when rendering via dangerouslySetInnerHTML or document.title.
 */
export function sanitizeText(text: string | null | undefined): string {
  if (!text) return '';
  // Remove all HTML tags
  return text.replace(/<[^>]*>/g, '').trim();
}

/**
 * isSafeUrl — boolean check version of sanitizeUrl.
 */
export function isSafeUrl(url: string | null | undefined): boolean {
  return sanitizeUrl(url) !== null;
}
