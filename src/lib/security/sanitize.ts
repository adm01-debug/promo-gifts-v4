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

  // Step 1: Strip dangerous block elements (script, style, etc.) including
  // their entire content. Must happen BEFORE generic tag stripping so
  // <script>alert(1)</script> doesn't leave "alert(1)" in the output.
  const DANGEROUS_BLOCKS =
    /<(script|style|iframe|object|embed|applet|form|link|meta|base)\b[^>]*>[\s\S]*?<\/\1>/gi;
  let current = text;
  let prev = '';
  while (prev !== current) {
    prev = current;
    current = current.replace(DANGEROUS_BLOCKS, '');
  }

  // Step 2: Iteratively strip remaining HTML tags until stable (prevents
  // incomplete-multi-character-sanitization where "<scr<script>ipt>" would
  // survive a single-pass strip).
  for (let i = 0; i < 20; i++) {
    const next = current.replace(/<[^>]*>/g, '');
    if (next === current) break;
    current = next;
  }

  // Remove any remaining lone angle brackets that could not form a valid tag
  return current.replace(/[<>]/g, '').trim();
}

/**
 * isSafeUrl — boolean check version of sanitizeUrl.
 */
export function isSafeUrl(url: string | null | undefined): boolean {
  return sanitizeUrl(url) !== null;
}
