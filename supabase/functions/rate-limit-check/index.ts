import { getCorsHeaders, handleCorsPreflightIfNeeded } from '../_shared/cors.ts';
import { safeErrorResponse } from '../_shared/error-response.ts';
import { logSecurityEvent } from '../_shared/security.ts';
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const BodySchema = z.object({
  endpoint: z.enum(['login', 'api', 'ai', 'approval']).default('api'),
}).partial();

// Rate limit configuration
const RATE_LIMITS: Record<string, { maxRequests: number; windowMs: number }> = {
  login: { maxRequests: 5, windowMs: 60 * 1000 },
  api: { maxRequests: 100, windowMs: 60 * 1000 },
  ai: { maxRequests: 20, windowMs: 60 * 1000 },
  approval: { maxRequests: 5, windowMs: 60 * 1000 },
};

// In-memory store (note: resets on function cold start)
const requestCounts = new Map<string, { count: number; resetAt: number }>();

function getClientIP(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.headers.get('x-real-ip') || 'anonymous';
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let rawBody: unknown = {};
    try {
      rawBody = await req.json();
    } catch {
      // Empty body is fine — defaults apply
    }

    const parsed = BodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const endpoint = parsed.data.endpoint || 'api';
    const clientIP = getClientIP(req);
    const config = RATE_LIMITS[endpoint] || RATE_LIMITS.api;
    
    const key = `${endpoint}:${clientIP}`;
    const now = Date.now();
    
    let record = requestCounts.get(key);
    
    // Reset if window expired
    if (!record || now > record.resetAt) {
      record = { count: 0, resetAt: now + config.windowMs };
    }
    
    record.count++;
    requestCounts.set(key, record);
    
    // Clean old entries periodically
    if (Math.random() < 0.01) {
      for (const [k, v] of requestCounts.entries()) {
        if (now > v.resetAt) requestCounts.delete(k);
      }
    }
    
    const allowed = record.count <= config.maxRequests;
    const remaining = Math.max(0, config.maxRequests - record.count);
    const retryAfter = Math.ceil((record.resetAt - now) / 1000);

    if (!allowed) {
      console.log(`Rate limit exceeded for ${clientIP} on ${endpoint}`);
      
      // Log suspicious activity
      await logSecurityEvent('RATE_LIMIT_EXCEEDED', endpoint, clientIP, {
        count: record.count,
        limit: config.maxRequests,
        userAgent: req.headers.get('user-agent'),
      });
      
      return new Response(
        JSON.stringify({
          allowed: false,
          error: 'Rate limit exceeded',
          remaining: 0,
          retryAfter,
          resetAt: new Date(record.resetAt).toISOString(),
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': config.maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': record.resetAt.toString(),
            'Retry-After': retryAfter.toString(),
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        allowed: true,
        remaining,
        resetAt: new Date(record.resetAt).toISOString(),
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': config.maxRequests.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': record.resetAt.toString(),
        },
      }
    );
  } catch (error) {
    // Fail-open: em erro interno liberamos a requisição, sem vazar o motivo.
    return safeErrorResponse(error, {
      corsHeaders,
      status: 200,
      publicMessage: 'rate_limit_unavailable',
      logLabel: 'Rate limit check error:',
      extra: { allowed: true },
    });
  }
});