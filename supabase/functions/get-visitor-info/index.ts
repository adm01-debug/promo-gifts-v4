import { publicCorsHeaders } from '../_shared/cors.ts';
import { runBotProtection } from '../_shared/bot-protection.ts';

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: publicCorsHeaders });
  }

  const headers = { ...publicCorsHeaders, 'Content-Type': 'application/json' };

  const botResult = await runBotProtection(
    req,
    { endpoint: 'get-visitor-info', maxRequests: 30, windowSeconds: 60 },
    publicCorsHeaders,
  );
  if (!botResult.allowed) return botResult.blockResponse!;

  try {
    // Extract visitor IP from proxy headers — only use the first (leftmost) entry
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      null;

    let city: string | null = null;
    let countryCode: string | null = null;

    // Server-side geolocation lookup (no CORS/sandbox issues)
    if (ip && ip !== 'unknown') {
      try {
        const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=city,countryCode`, {
          signal: AbortSignal.timeout(3000),
        });
        if (geoRes.ok) {
          const geo = await geoRes.json();
          city = geo.city || null;
          countryCode = geo.countryCode || null;
        }
      } catch {
        // Geo lookup failed, still return IP
      }
    }

    return new Response(
      JSON.stringify({ ip, city, country_code: countryCode }),
      { status: 200, headers }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal error';
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers });
  }
});
