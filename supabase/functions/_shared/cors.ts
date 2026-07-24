// supabase/functions/_shared/cors.ts
/**
 * Centralized CORS configuration — restrict to known origins.
 *
 * BUG-07 FIX (2026-06-02): getBestAllowedOrigin() fallback was returning
 *   the Lovable dev URL (criar-together-now.lovable.app) for unknown origins.
 *   Changed to production URL (www.promogifts.com.br).
 *
 * BUG-08 FIX (2026-06-02): pqpdolkaeqlyzpdpbizo.supabase.co removed from
 *   EXACT_ALLOWED_ORIGINS. That project is in FORBIDDEN_REFS in client.ts
 *   and must not be granted CORS access to edge functions.
 */

// --- Configuration ---

const EXACT_ALLOWED_ORIGINS = new Set([
  // BUG-08 FIX: pqpdolkaeqlyzpdpbizo.supabase.co removed (FORBIDDEN project).
  // That project is the old Lovable Cloud instance with no catalog. The canonical
  // production project is doufsxqlfjyuvxuezpln (Gold/Medallion); its origins are
  // listed below (promogifts.com.br, vercel.app previews, lovable.app, localhost).
  'https://criar-together-now.lovable.app',
  'https://id-preview--1be35a65-1f65-4c2b-9a79-7d563930aacd.lovable.app',
  'https://1be35a65-1f65-4c2b-9a79-7d563930aacd.lovableproject.com',
  'https://promogifts.com.br',
  'https://www.promogifts.com.br',
  'https://promogifts.atomicabr.com.br',
  'http://localhost:5173',
  'http://localhost:8080',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:3000',
]);

const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/[a-z0-9-]+\.lovable\.app$/i,
  /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/i,
  /^https:\/\/[a-z0-9-]+\.atomicabr\.com\.br$/i,
  /^https:\/\/[a-z0-9-]+\.vercel\.app$/i,
  /^http:\/\/localhost(?::\d+)?$/i,
  /^http:\/\/127\.0\.0\.1(?::\d+)?$/i,
];

const ALLOWED_HEADERS_LIST = [
  'authorization',
  'x-client-info',
  'apikey',
  'content-type',
  'x-request-id',
  'x-step-up-token',
  'x-supabase-client-platform',
  'x-supabase-client-platform-version',
  'x-supabase-client-runtime',
  'x-supabase-client-runtime-version',
];

const ALLOWED_HEADERS_SET = new Set(ALLOWED_HEADERS_LIST.map((h) => h.toLowerCase()));
const ALLOWED_HEADERS_VALUE = ALLOWED_HEADERS_LIST.join(', ');

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'strict-dynamic'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests;",
} as const;

const CORS_HEADERS_BASE = {
  'Access-Control-Allow-Headers': ALLOWED_HEADERS_VALUE,
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Expose-Headers': 'x-request-id',
  ...SECURITY_HEADERS,
} as const;

// --- Internal Utilities ---

function parseHeaderList(headerString: string | null): string[] {
  if (!headerString) return [];
  return headerString
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

function isAllowedOrigin(origin: string): boolean {
  return (
    EXACT_ALLOWED_ORIGINS.has(origin) ||
    ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin))
  );
}

function getBestAllowedOrigin(origin: string | null): string {
  if (origin && isAllowedOrigin(origin)) return origin;
  // BUG-07 FIX: Unknown origin now falls back to the PRODUCTION URL instead
  // of the Lovable development URL (criar-together-now.lovable.app).
  // The browser still blocks the response if the origin doesn't match anyway,
  // so this only matters for same-origin requests and server-side callers.
  return 'https://www.promogifts.com.br';
}

// --- Structured Logging ---

function logCorsEvent(event: string, fields: Record<string, unknown>): void {
  const payload = {
    source: 'cors',
    event,
    ts: new Date().toISOString(),
    ...fields,
  };
  const line = `[cors] ${JSON.stringify(payload)}`;
  
  if (event.endsWith('_warn') || event.endsWith('_blocked')) {
    console.warn(line);
  } else {
    console.log(line);
  }
}

let bootLogged = false;
function logBootIfNeeded(): void {
  if (bootLogged) return;
  bootLogged = true;
  logCorsEvent('cors_boot', {
    allow_headers: ALLOWED_HEADERS_VALUE,
    allow_headers_count: ALLOWED_HEADERS_LIST.length,
    allow_methods: CORS_HEADERS_BASE['Access-Control-Allow-Methods'],
    expose_headers: CORS_HEADERS_BASE['Access-Control-Expose-Headers'],
    exact_origins_count: EXACT_ALLOWED_ORIGINS.size,
    pattern_origins_count: ALLOWED_ORIGIN_PATTERNS.length,
  });
}

// Initialize boot log on module load
logBootIfNeeded();

function logPreflightFromRequest(req: Request, origin: string): void {
  const requestedHeadersRaw = req.headers.get('Access-Control-Request-Headers') || req.headers.get('access-control-request-headers');
  const requestedMethod = req.headers.get('Access-Control-Request-Method') || req.headers.get('access-control-request-method');
  const requestedHeaders = parseHeaderList(requestedHeadersRaw);
  
  const missingHeaders = requestedHeaders.filter((h) => !ALLOWED_HEADERS_SET.has(h));
  const originAllowed = !origin || isAllowedOrigin(origin);
  const requestId = req.headers.get('x-request-id') || req.headers.get('X-Request-Id');

  const baseFields = {
    request_id: requestId,
    origin: origin || null,
    origin_allowed: originAllowed,
    requested_method: requestedMethod,
    requested_headers: requestedHeaders,
    missing_headers: missingHeaders,
  };

  if (!originAllowed || missingHeaders.length > 0) {
    logCorsEvent('cors_preflight_warn', {
      ...baseFields,
      reason: !originAllowed ? 'origin_not_allowed' : 'header_not_allowed',
      hint: missingHeaders.length > 0
        ? `Add to ALLOWED_HEADERS_LIST in _shared/cors.ts: ${missingHeaders.join(', ')}`
        : 'Add origin to EXACT_ALLOWED_ORIGINS or ALLOWED_ORIGIN_PATTERNS',
    });
  } else {
    logCorsEvent('cors_preflight_ok', baseFields);
  }
}

// --- Public API ---

/**
 * Returns CORS headers with origin validation.
 * If the request origin is in the allowlist, it is reflected back.
 */
export function getCorsHeaders(req?: Request): Record<string, string> {
  const origin = req?.headers.get('origin') || req?.headers.get('Origin') || '';
  
  if (req?.method === 'OPTIONS') {
    logPreflightFromRequest(req, origin);
  }

  return {
    ...CORS_HEADERS_BASE,
    ...SECURITY_HEADERS,
    'Access-Control-Allow-Origin': getBestAllowedOrigin(origin),
  };
}

/**
 * Handle CORS preflight (OPTIONS) request.
 * Returns a Response if it's an OPTIONS request, null otherwise.
 */
export function handleCorsPreflightIfNeeded(req: Request): Response | null {
  if (req.method !== 'OPTIONS') return null;
  return new Response(null, { headers: getCorsHeaders(req) });
}

export interface PublicCorsOptions {
  /**
   * Extra header tokens to append to Access-Control-Allow-Headers.
   */
  extraAllowHeaders?: string[];
  /**
   * Override Access-Control-Allow-Methods (default: same as restricted helper).
   */
  allowMethods?: string;
}

/**
 * Build CORS headers for public/wildcard endpoints.
 */
export function buildPublicCorsHeaders(opts: PublicCorsOptions = {}): Record<string, string> {
  const merged = new Set(ALLOWED_HEADERS_LIST.map((h) => h.toLowerCase()));
  for (const h of opts.extraAllowHeaders ?? []) {
    const t = h.trim().toLowerCase();
    if (t) merged.add(t);
  }
  
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': Array.from(merged).join(', '),
    'Access-Control-Allow-Methods': opts.allowMethods ?? CORS_HEADERS_BASE['Access-Control-Allow-Methods'],
    'Access-Control-Expose-Headers': 'x-request-id',
    ...SECURITY_HEADERS,
  };
}

/**
 * Unified preflight handler — works for BOTH public-wildcard and origin-restricted endpoints.
 */
export function handleCorsPreflight(
  req: Request,
  opts: { public?: boolean } & PublicCorsOptions = {},
): Response | null {
  if (req.method !== 'OPTIONS') return null;
  
  if (opts.public) {
    const origin = req.headers.get('origin') || req.headers.get('Origin') || '';
    logPreflightFromRequest(req, origin);
    return new Response(null, { headers: buildPublicCorsHeaders(opts) });
  }
  
  return new Response(null, { headers: getCorsHeaders(req) });
}

/**
 * @deprecated Use `buildPublicCorsHeaders()` or `handleCorsPreflight(req, { public: true })`.
 */
export const publicCorsHeaders = Object.freeze(buildPublicCorsHeaders());

/**
 * Exported for tests / introspection.
 */
export const CORS_INTROSPECTION = Object.freeze({
  allowHeaders: ALLOWED_HEADERS_VALUE,
  allowHeadersList: Object.freeze([...ALLOWED_HEADERS_LIST]),
  allowMethods: CORS_HEADERS_BASE['Access-Control-Allow-Methods'],
  exposeHeaders: CORS_HEADERS_BASE['Access-Control-Expose-Headers'],
});
