// supabase/functions/_shared/bot-protection.ts
// Centralized anti-scraping/bot protection for public Edge Functions.
// Combines: (1) User-Agent blacklist, (2) DB-backed rate limit, (3) bot logging.

import { createClient } from "npm:@supabase/supabase-js@2.49.4";

// Known scraper / automation User-Agents (case-insensitive substring match)
const BOT_UA_PATTERNS = [
  'curl/', 'wget/', 'python-requests', 'python-urllib', 'scrapy', 'httpie',
  'go-http-client', 'java/', 'okhttp', 'apache-httpclient',
  'phantomjs', 'headlesschrome', 'puppeteer', 'playwright',
  'libwww-perl', 'lwp::', 'mechanize', 'http_request2',
  'ahrefsbot', 'semrushbot', 'mj12bot', 'dotbot', 'rogerbot',
  'screaming frog', 'sitebulb', 'megaindex', 'serpstatbot',
  'node-fetch', 'axios/', 'got (', 'undici',
  // Generic suspicious markers
  'crawler', 'scraper', 'spider', 'bot/', '/bot',
];

// Allow-listed bots (search engines we want to allow for SEO)
const ALLOWED_BOT_PATTERNS = [
  'googlebot', 'bingbot', 'duckduckbot', 'yandexbot', 'baiduspider',
  'facebookexternalhit', 'twitterbot', 'linkedinbot', 'whatsapp', 'telegrambot',
  'slackbot', 'discordbot',
];

export interface BotCheckResult {
  isBot: boolean;
  isAllowedBot: boolean;
  reason?: string;
  matchedPattern?: string;
}

/** Detect bots by User-Agent string. */
export function detectBot(userAgent: string | null): BotCheckResult {
  if (!userAgent || userAgent.trim().length === 0) {
    return { isBot: true, isAllowedBot: false, reason: 'empty_user_agent' };
  }
  const ua = userAgent.toLowerCase();

  // Allow-listed first
  for (const pattern of ALLOWED_BOT_PATTERNS) {
    if (ua.includes(pattern)) {
      return { isBot: true, isAllowedBot: true, matchedPattern: pattern };
    }
  }

  // Blocked
  for (const pattern of BOT_UA_PATTERNS) {
    if (ua.includes(pattern)) {
      return { isBot: true, isAllowedBot: false, reason: 'ua_blacklist', matchedPattern: pattern };
    }
  }

  // Suspiciously short or generic UAs
  if (userAgent.length < 20) {
    return { isBot: true, isAllowedBot: false, reason: 'suspicious_short_ua', matchedPattern: userAgent };
  }

  return { isBot: false, isAllowedBot: false };
}

/** Extract the best-effort client IP from a request. */
export function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('cf-connecting-ip')
    || req.headers.get('x-real-ip')
    || 'unknown';
}

interface BotProtectionOptions {
  endpoint: string;
  maxRequests?: number;        // default 60
  windowSeconds?: number;      // default 60
  blockSeconds?: number;       // default 3600 (1h)
  allowSearchBots?: boolean;   // default true
  customIdentifier?: string;   // override IP-based identifier
}

export interface BotProtectionResult {
  allowed: boolean;
  blockResponse?: Response;
}

// ─── Admin client singleton ────────────────────────────────────────────────
// Evita recriar handshake TLS a cada chamada de runBotProtection.
// Antes: createClient() chamado em TODA request → N handshakes paralelos em burst.
// Agora: 1 instância por isolate, reusada por todas as requests concorrentes.
let _botProtectionAdmin: ReturnType<typeof createClient> | null = null;
function getBotAdminClient(): ReturnType<typeof createClient> {
  if (_botProtectionAdmin) return _botProtectionAdmin;
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  _botProtectionAdmin = createClient(supabaseUrl, serviceKey);
  return _botProtectionAdmin;
}

/**
 * Run all anti-scraping checks. Returns { allowed: false, blockResponse } if blocked.
 * Logs detection events to bot_detection_log.
 */
export async function runBotProtection(
  req: Request,
  opts: BotProtectionOptions,
  corsHeaders: Record<string, string>,
): Promise<BotProtectionResult> {
  const ip = getClientIp(req);
  const ua = req.headers.get('user-agent');
  const admin = getBotAdminClient();

  const logBlock = async (reason: string, blocked: boolean, metadata: Record<string, unknown> = {}) => {
    try {
      await admin.from('bot_detection_log').insert({
        ip_address: ip,
        user_agent: ua,
        endpoint: opts.endpoint,
        detection_reason: reason,
        blocked,
        metadata,
      });
    } catch (err) {
      console.error('[bot-protection] Failed to log:', err);
    }
  };

  // 0. Manual allowlist/blocklist check (admin overrides)
  try {
    const { data: ipAccess } = await admin.rpc('check_ip_access', { _ip: ip });
    if (ipAccess === 'block') {
      await logBlock('manual_blocklist', true, { ip });
      return {
        allowed: false,
        blockResponse: new Response(
          JSON.stringify({ error: 'Forbidden', message: 'Access denied' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        ),
      };
    }
    if (ipAccess === 'allow') {
      // Skip all subsequent checks for trusted IPs
      return { allowed: true };
    }
  } catch (err) {
    console.error('[bot-protection] IP access check failed:', err);
    // Fail open
  }

  // 1. Bot UA check
  const botCheck = detectBot(ua);
  const allowSearch = opts.allowSearchBots !== false;

  if (botCheck.isBot && !(allowSearch && botCheck.isAllowedBot)) {
    await logBlock(botCheck.reason || 'bot_detected', true, { matched: botCheck.matchedPattern });
    return {
      allowed: false,
      blockResponse: new Response(
        JSON.stringify({ error: 'Forbidden', message: 'Automated access not allowed' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      ),
    };
  }

  // 2. Persistent rate limit via DB function
  const identifier = opts.customIdentifier || ip;
  const { data, error } = await admin.rpc('check_rate_limit', {
    _identifier: identifier,
    _endpoint: opts.endpoint,
    _max_requests: opts.maxRequests ?? 60,
    _window_seconds: opts.windowSeconds ?? 60,
    _block_duration_seconds: opts.blockSeconds ?? 3600,
  });

  if (error) {
    console.error('[bot-protection] Rate limit RPC error:', error);
    // Fail open to avoid breaking service on DB hiccup
    return { allowed: true };
  }

  const result = data as { allowed: boolean; reason?: string; retry_after_seconds?: number; remaining?: number };
  if (!result?.allowed) {
    await logBlock(result?.reason || 'rate_exceeded', true, { result });
    const retryAfter = result?.retry_after_seconds ?? 60;
    return {
      allowed: false,
      blockResponse: new Response(
        JSON.stringify({
          error: 'Too Many Requests',
          message: 'Limite de requisições excedido. Tente novamente mais tarde.',
          retry_after_seconds: retryAfter,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Retry-After': String(retryAfter),
          },
        },
      ),
    };
  }

  return { allowed: true };
}
