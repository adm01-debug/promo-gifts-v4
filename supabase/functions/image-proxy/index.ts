import { getCorsHeaders } from '../_shared/cors.ts';
import { runBotProtection } from '../_shared/bot-protection.ts';
import { fetchWithBreaker, CircuitOpenError, circuitOpenResponse } from '../_shared/external-fetch.ts';

// BUG-A04 FIX (26/05/2026): Expanded ALLOWED_DOMAINS to include all active suppliers.
// Previously only 'spotgifts.com.br' was allowed — XBZ, Asia Import, Só Marcas and
// Cloudflare Images were all blocked with 403.
const ALLOWED_DOMAINS = [
  // Promo Brindes suppliers
  'www.spotgifts.com.br',
  'spotgifts.com.br',
  'cdn.xbzbrindes.com.br',        // XBZ CDN de imagens — 67.96% product_images
  'www.xbzbrindes.com.br',
  'api.minhaxbz.com.br',          // XBZ API (manter por compatibilidade)
  'minhaxbz.com.br',
  'cdndeprodutos.azureedge.net', // XBZ Azure CDN — 4.5% product_images
  'media.asiaimport.com.br',     // Asia Import CDN — 8.96% product_images
  'asiaimport.com.br',           // Asia Import
  'www.asiaimport.com.br',
  'somarcascdn.azureedge.net',   // Só Marcas Azure CDN — 2.38% product_images
  'somarcas.com.br',             // Só Marcas
  'www.somarcas.com.br',
  // Cloudflare Images (imagedelivery.net is the CDN domain)
  'imagedelivery.net',
  // Supabase Storage (for locally cached/uploaded images)
  'doufsxqlfjyuvxuezpln.supabase.co',
  'supabase.co',
];

// BUG-A05 FIX (26/05/2026): Added staging/beta domains to ALLOWED_REFERER_HOSTS.
// promo-gifts-beta.vercel.app was missing — staging environment was rejected.
const ALLOWED_REFERER_EXACT = new Set([
  'criar-together-now.lovable.app',
  // First-party Lovable preview environments (same as _shared/cors.ts EXACT_ALLOWED_ORIGINS)
  'id-preview--1be35a65-1f65-4c2b-9a79-7d563930aacd.lovable.app',
  '1be35a65-1f65-4c2b-9a79-7d563930aacd.lovableproject.com',
  'promogifts.com.br',
  'www.promogifts.com.br',
  'promogifts.atomicabr.com.br',
  'promo-gifts-beta.vercel.app',
]);

// Vercel preview pattern: only this team's deployments (suffix -juca1.vercel.app)
const VERCEL_TEAM_PATTERN = /^[\w-]+-juca1\.vercel\.app$/i;
// Lovable: no wildcard — specific project domains go in ALLOWED_REFERER_EXACT above.
// A wildcard *.lovable.app / *.lovableproject.com would allow any Lovable tenant to hotlink.

const ALLOW_LOCALHOST = Deno.env.get('IMAGE_PROXY_ALLOW_LOCALHOST') === 'true';

function isAllowedReferer(referer: string | null): boolean {
  if (!referer) return false;
  try {
    const host = new URL(referer).hostname.toLowerCase();
    return (
      ALLOWED_REFERER_EXACT.has(host) ||
      VERCEL_TEAM_PATTERN.test(host) ||
      (ALLOW_LOCALHOST && (host === 'localhost' || host === '127.0.0.1'))
    );
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
    const protection = await runBotProtection(req, {
      endpoint: 'image-proxy',
      maxRequests: 200,
      windowSeconds: 60,
      blockSeconds: 1800,
      allowSearchBots: true,
    }, corsHeaders);
    if (!protection.allowed) return protection.blockResponse!;

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
      return new Response(JSON.stringify({ error: 'Domain not allowed', hostname: parsedUrl.hostname }), {
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

    const maxBytes = parseInt(Deno.env.get('IMAGE_PROXY_MAX_BYTES') || '5242880', 10);
    const contentLength = imageResponse.headers.get('content-length');
    
    if (contentLength && parseInt(contentLength, 10) > maxBytes) {
      console.warn(`[image-proxy] Blocking oversized image: ${contentLength} bytes from ${imageUrl}`);
      return new Response(JSON.stringify({ error: 'Image too large' }), {
        status: 413,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const contentType = imageResponse.headers.get('Content-Type') || 'image/jpeg';
    
    if (!contentType.toLowerCase().startsWith('image/')) {
      console.warn(`[image-proxy] Blocking non-image content: ${contentType} from ${imageUrl}`);
      return new Response(JSON.stringify({ error: 'Source is not an image' }), {
        status: 415,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const imageBuffer = await imageResponse.arrayBuffer();

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
