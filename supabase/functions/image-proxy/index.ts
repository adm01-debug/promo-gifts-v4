import { getCorsHeaders } from '../_shared/cors.ts';
import { runBotProtection } from '../_shared/bot-protection.ts';
import { fetchWithBreaker, CircuitOpenError, circuitOpenResponse } from '../_shared/external-fetch.ts';

// Allowed external domains for proxying
const ALLOWED_DOMAINS = [
  'www.spotgifts.com.br',
  'spotgifts.com.br',
];

// Allowed referer hosts (anti-hotlinking)
const ALLOWED_REFERER_HOSTS = [
  'criar-together-now.lovable.app',
  'promogifts.com.br',
  'www.promogifts.com.br',
  'lovable.app',          // any *.lovable.app subdomain
  'lovableproject.com',
];

// Localhost/127.0.0.1 conditional (Hardening 6.3)
if (Deno.env.get('IMAGE_PROXY_ALLOW_LOCALHOST') === 'true') {
  ALLOWED_REFERER_HOSTS.push('localhost', '127.0.0.1');
}

function isAllowedReferer(referer: string | null): boolean {
  if (!referer) return false;
  try {
    const host = new URL(referer).hostname.toLowerCase();
    return ALLOWED_REFERER_HOSTS.some((allowed) => host === allowed || host.endsWith('.' + allowed));
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Anti-scraping protection (bot UA check + rate limit per IP)
    // Generous limit because images are loaded in batches; abuse means hundreds/min from same IP.
    const protection = await runBotProtection(req, {
      endpoint: 'image-proxy',
      maxRequests: 200,        // 200 imagens/min por IP
      windowSeconds: 60,
      blockSeconds: 1800,      // 30min de bloqueio
      allowSearchBots: true,
    }, corsHeaders);
    if (!protection.allowed) return protection.blockResponse!;

    // 2. Anti-hotlinking: only serve when called from our own domains
    const referer = req.headers.get('referer') || req.headers.get('origin');
    if (referer && !isAllowedReferer(referer)) {
      return new Response(JSON.stringify({ error: 'Hotlinking not allowed' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const imageUrl = url.searchParams.get('url');

    if (!imageUrl) {
      return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(imageUrl);
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid URL' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!ALLOWED_DOMAINS.includes(parsedUrl.hostname)) {
      return new Response(JSON.stringify({ error: 'Domain not allowed' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const imageResponse = await fetchWithBreaker("image-cdn", imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ImageProxy/1.0)',
        'Accept': 'image/*',
      },
    });

    if (!imageResponse.ok) {
      return new Response(JSON.stringify({ error: 'Failed to fetch image', status: imageResponse.status }), {
        status: imageResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Hardening 6.3: Max bytes limit
    const maxBytes = parseInt(Deno.env.get('IMAGE_PROXY_MAX_BYTES') || '5242880', 10); // Default 5MB
    const contentLength = imageResponse.headers.get('content-length');
    
    if (contentLength && parseInt(contentLength, 10) > maxBytes) {
      console.warn(`[image-proxy] Blocking oversized image: ${contentLength} bytes from ${imageUrl}`);
      return new Response(JSON.stringify({ error: 'Image too large' }), {
        status: 413, // Payload Too Large
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const contentType = imageResponse.headers.get('Content-Type') || 'image/jpeg';
    
    // Critical #4 fix: Validate Content-Type to prevent content-sniffing or HTML injection
    if (!contentType.toLowerCase().startsWith('image/')) {
      console.warn(`[image-proxy] Blocking non-image content: ${contentType} from ${imageUrl}`);
      return new Response(JSON.stringify({ error: 'Source is not an image' }), {
        status: 415, // Unsupported Media Type
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const imageBuffer = await imageResponse.arrayBuffer();

    // Secondary check if Content-Length was missing
    if (imageBuffer.byteLength > maxBytes) {
      console.warn(`[image-proxy] Blocking oversized buffer: ${imageBuffer.byteLength} bytes from ${imageUrl}`);
      return new Response(JSON.stringify({ error: 'Image too large' }), {
        status: 413,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(imageBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=604800',
        'X-Proxied-From': parsedUrl.hostname,
        'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet, noimageindex',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
    });
  } catch (error) {
    console.error('Image proxy error:', error);
    if (error instanceof CircuitOpenError) {
      return circuitOpenResponse(error, corsHeaders);
    }
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
