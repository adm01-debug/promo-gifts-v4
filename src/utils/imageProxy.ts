/**
 * Proxy de imagens externas para evitar CORS
 * Reescreve URLs de domínios de fornecedores para passar pelo edge function proxy
 *
 * BUG-CORS-SUPPLIERS FIX v2 (2026-06-23):
 * Domínios corrigidos após auditoria de product_images.url_original (72.330 imgs com URL):
 *
 *   cdn.xbzbrindes.com.br      67.96% (40.708 imgs) ← XBZ imagem CDN (CORRIGIDO)
 *   www.spotgifts.com.br       15.30%  (9.167 imgs) ← SPOT
 *   media.asiaimport.com.br     8.96%  (5.370 imgs) ← Asia Import media (CORRIGIDO)
 *   cdndeprodutos.azureedge.net 5.38%  (3.225 imgs) ← Azure CDN genérico
 *   somarcascdn.azureedge.net   2.38%  (1.428 imgs) ← Só Marcas Azure CDN (CORRIGIDO)
 *   ─────────────────────────────────────────────────
 *   Cobertura total: 99.98% das imagens com url_original
 *
 * Fix anterior (v1) usava domínios de API (api.minhaxbz.com.br) e subdomínios errados
 * (asiaimport.com.br, somarcas.com.br) ao invés dos CDNs reais.
 * Fonte: SELECT hostname, COUNT(*) FROM product_images GROUP BY 1 ORDER BY 2 DESC
 */

const PROXIED_DOMAINS = new Set([
  // XBZ Brindes — 67.96% (maior supplier) — CDN de imagens
  'cdn.xbzbrindes.com.br',
  'www.xbzbrindes.com.br',
  // SPOT (Stricker) — 15.30%
  'www.spotgifts.com.br',
  'spotgifts.com.br',
  // Asia Import — 8.96% — subdomínio media (não apex)
  'media.asiaimport.com.br',
  'asiaimport.com.br',
  'www.asiaimport.com.br',
  // Azure CDN genérico (mixed suppliers) — 5.38%
  'cdndeprodutos.azureedge.net',
  // Só Marcas — 2.38% — Azure CDN próprio
  'somarcascdn.azureedge.net',
  'somarcas.com.br',
  'www.somarcas.com.br',
]);

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

/**
 * Retorna a URL proxiada se o domínio requer proxy, senão retorna a original.
 * Set.has() é O(1) vs Array.includes() O(n) — crítico para render de 80+ cards.
 */
export function getProxiedImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    if (PROXIED_DOMAINS.has(parsed.hostname)) {
      return `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/image-proxy?url=${encodeURIComponent(url)}`;
    }
  } catch {
    // URL inválida, retorna como está
  }

  return url;
}

/**
 * Verifica se uma URL precisa de proxy
 */
export function needsProxy(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return PROXIED_DOMAINS.has(parsed.hostname);
  } catch {
    return false;
  }
}

// ─── Derivação determinística de url_original a partir de CF URL / CF ID ───
//
// SPOT: `spot-{ref}_{color}` → spotgifts.com.br/fotos/produtos/{ref}_{color}.jpg
// Outros fornecedores: padrão opaco → não derivável sem lookup no banco.

const SPOT_ORIGIN_BASE = 'https://www.spotgifts.com.br/fotos/produtos/';

/**
 * Tenta derivar a url_original do fornecedor a partir da URL CDN do Cloudflare.
 * Retorna null quando o padrão não é reconhecido.
 */
export function deriveOriginalUrl(cfUrl: string | null | undefined): string | null {
  if (!cfUrl) return null;
  try {
    if (!cfUrl.includes('imagedelivery.net')) return null;
    const parts = cfUrl.split('/');
    if (parts.length < 5) return null;
    const cfId = parts[parts.length - 2];
    if (
      cfId.startsWith('spot-') &&
      !cfId.startsWith('spot-area-') &&
      !cfId.startsWith('spot-pa-')
    ) {
      const withoutPrefix = cfId.slice(5);
      const typeSpecific = ['_set', '_box', '_amb', '_pouch', '-b', '-c', '-d', '-e', '-f', '-g'];
      const hasTypeSuffix = typeSpecific.some((sfx) => withoutPrefix.endsWith(sfx));
      if (!hasTypeSuffix && withoutPrefix.includes('_')) {
        return `${SPOT_ORIGIN_BASE}${withoutPrefix}.jpg`;
      }
    }
    return null;
  } catch {
    return null;
  }
}
