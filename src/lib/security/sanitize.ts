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
// Private/loopback/link-local hostname patterns blocked to prevent SSRF.
// Covers IPv4 private ranges, IPv6 loopback/link-local, IPv4-mapped IPv6, and internal TLDs.
const SSRF_BLOCKED_HOSTNAME = (hostname: string): boolean => {
  // Strip IPv6 brackets: [::1] → ::1
  const h = hostname.replace(/^\[|\]$/g, '').toLowerCase();

  // IPv4-mapped IPv6: ::ffff:xxxx:xxxx — WHATWG URL parser normalises all forms
  // (mixed notation ::ffff:127.0.0.1, full 0:0:0:0:0:ffff:7f00:1) to this compact form.
  // The last two 16-bit groups encode the IPv4 address: ::ffff:hi:lo → hi.lo IPv4.
  // Example: ::ffff:7f00:1 → 127.0.0.1, ::ffff:a9fe:a9fe → 169.254.169.254 (AWS metadata)
  const ipv4Mapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(h);
  if (ipv4Mapped) {
    const hi = parseInt(ipv4Mapped[1], 16);
    const lo = parseInt(ipv4Mapped[2], 16);
    const derivedIpv4 = `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`;
    if (SSRF_BLOCKED_HOSTNAME(derivedIpv4)) return true;
  }

  return (
    h === 'localhost' ||
    h === '0.0.0.0' ||
    h === '::1' ||
    h.startsWith('127.') ||        // 127.0.0.0/8 loopback
    h.startsWith('10.') ||         // 10.0.0.0/8 private
    h.startsWith('192.168.') ||    // 192.168.0.0/16 private
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) || // 172.16-31.x private
    /^169\.254\./.test(h) ||       // 169.254.0.0/16 link-local
    /^fe[89ab][0-9a-f]:/i.test(h) || // IPv6 link-local fe80::/10
    /\.(local|internal|corp|intranet|lan)$/i.test(h) // common internal TLDs
  );
};

export function sanitizeUrl(
  url: string | null | undefined,
  options: { httpsOnly?: boolean; allowEmpty?: boolean } = {},
): string | null {
  if (!url) {
    return options.allowEmpty ? '' : null;
  }

  // CRIT-2: typeof guard before .trim() — truthy non-strings (numbers, objects)
  // would throw TypeError inside the try-catch-less zone.
  if (typeof url !== 'string') return null;

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

    // CRIT-1: Block embedded credentials (user:pass@host) — potential credential exfil.
    if (parsed.username || parsed.password) {
      console.warn('[SecurityGuard] Blocked URL with embedded credentials');
      return null;
    }

    // CRIT-1: Block private/loopback/link-local hosts — SSRF prevention.
    // WHATWG URL parser normalises octal (0177.0.0.1), hex (0x7f000001) and
    // decimal (2130706433) representations before we reach here, so hostname
    // comparison is reliable against all encoding tricks.
    if (SSRF_BLOCKED_HOSTNAME(parsed.hostname)) {
      console.warn('[SecurityGuard] Blocked SSRF-risk hostname:', parsed.hostname);
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
  // Iteratively strip HTML tags until stable (prevents incomplete-multi-character-sanitization
  // where e.g. "<scr<script>ipt>" survives a single-pass strip).
  let current = text;
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
