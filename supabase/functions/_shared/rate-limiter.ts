// supabase/functions/_shared/rate-limiter.ts
import { createClient } from "npm:@supabase/supabase-js@2.49.4"; // fix_version=2026-07-09-rate-limiter-esm-sh ANTI-REGRESSÃO

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  keyPrefix?: string;
  /**
   * When true, DB errors block the request (fail-closed). Use for auth/sensitive endpoints.
   * When false (default), DB errors allow the request (fail-open). Use for non-critical endpoints.
   */
  failClosed?: boolean;
}

/**
 * Persistent Rate Limiter using Supabase DB.
 * Fixed Critical #2 from 2026-05-12 Audit.
 */
export class RateLimiter {
  constructor(private config: RateLimitConfig) {}

  async check(identifier: string): Promise<{ allowed: boolean; remaining: number; resetAt: number; suspicious?: boolean }> {
    const key = `${this.config.keyPrefix || 'rl'}:${identifier}`;
    
    // Use Admin Client to bypass RLS and access the rate limits table
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    try {
      // Atomic increment and check via RPC
      const { data, error } = await supabaseAdmin.rpc('check_edge_rate_limit', {
        p_key: key,
        p_window_ms: this.config.windowMs,
        p_max_requests: this.config.maxRequests
      });

      if (error) {
        console.error(`[rate-limiter] Error checking rate limit for ${key}:`, error);
        if (this.config.failClosed) {
          // Fail-closed: block the request when rate limit DB is unavailable (auth endpoints).
          return { allowed: false, remaining: 0, resetAt: Date.now() + this.config.windowMs };
        }
        // Fail-open: allow the request (non-critical endpoints, prioritize availability).
        return { allowed: true, remaining: 1, resetAt: Date.now() + this.config.windowMs };
      }

      const result = data[0];
      const now = Date.now();
      const resetAt = new Date(result.reset_at).getTime();

      // Detection of suspicious attempts: 
      // if the user reached 80% of the limit very fast (e.g. in less than 10% of the window)
      const usageRatio = (this.config.maxRequests - result.remaining) / this.config.maxRequests;
      const timeRatio = (now - (resetAt - this.config.windowMs)) / this.config.windowMs;
      const suspicious = usageRatio > 0.8 && timeRatio < 0.1;

      return {
        allowed: result.allowed,
        remaining: result.remaining,
        resetAt: resetAt,
        suspicious
      };
    } catch (err) {
      console.error(`[rate-limiter] Fatal error checking rate limit for ${key}:`, err);
      if (this.config.failClosed) {
        return { allowed: false, remaining: 0, resetAt: Date.now() + this.config.windowMs };
      }
      return { allowed: true, remaining: 1, resetAt: Date.now() + this.config.windowMs };
    }
  }
}

// Rate limiters pre-configured
export const rateLimiters = {
  // AI endpoints: 20 req/min per user
  ai: new RateLimiter({
    maxRequests: 20,
    windowMs: 60 * 1000,
    keyPrefix: 'ai'
  }),

  // Search: 100 req/min per user
  search: new RateLimiter({
    maxRequests: 100,
    windowMs: 60 * 1000,
    keyPrefix: 'search'
  }),

  // Approval: 5 req/min per token (avoid brute force) — fail-closed: block on DB error
  approval: new RateLimiter({
    maxRequests: 5,
    windowMs: 60 * 1000,
    keyPrefix: 'approval',
    failClosed: true,
  })
};

// Middleware helper
export async function applyRateLimit(
  req: Request,
  limiter: RateLimiter,
  getIdentifier: (req: Request) => string = (r) => r.headers.get('x-forwarded-for') || 'anonymous'
): Promise<Response | null> {
  const identifier = getIdentifier(req);
  const result = await limiter.check(identifier);

  if (result.suspicious) {
    console.warn(`[suspicious-activity] ID: ${identifier} endpoint: ${limiter['config'].keyPrefix}`);
  }

  if (!result.allowed) {
    return new Response(
      JSON.stringify({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        remaining: result.remaining,
        resetAt: new Date(result.resetAt).toISOString()
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': limiter['config'].maxRequests.toString(),
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': result.resetAt.toString(),
          'Retry-After': Math.ceil((result.resetAt - Date.now()) / 1000).toString()
        }
      }
    );
  }

  return null; // null = allowed
}
