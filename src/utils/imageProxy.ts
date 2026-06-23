/**
 * Proxy de imagens externas para evitar CORS
 * Reescreve URLs de domínios bloqueados para passar pelo edge function proxy
 *
 * BUG-CORS-SUPPLIERS FIX (2026-06-23):
 * PROXIED_DOMAINS estava limitado a spotgifts.com.br (12.7% das imagens).
 * product_images.url_original contém URLs de 5 fornecedores distintos:
 *   - XBZ/minhaxbz: 56.6% (40.710 imagens) ← maior supplier, sem proxy!
 *   - SPOT: 12.7% (9.167 imagens) ← único proxiado antes deste fix
 *   - Asia Import: 7.5% (5.370 imagens) ← sem proxy
 *   - Azure CDN XBZ: 4.5% (3.225 imagens) ← sem proxy
 *   - Só Marcas: 2.0% (1.428 imagens) ← sem proxy
 * Sem proxy, quando a imagem Cloudflare CDN falha, o browser tenta carregar
 * a url_original diretamente → CORS error para 87.3% das imagens.
 * Fix: adicionar todos os domínios de fornecedores ao PROXIED_DOMAINS.
 * A edge function image-proxy já suporta estes domínios em ALLOWED_DOMAINS.
 */

const PROXIED_DOMAINS = new Set([
  // SPOT (Stricker) — 12.7% das imagens
  'www.spotgifts.com.br',
  'spotgifts.com.br',
  // XBZ Brindes — 56.6% das imagens (maior supplier)
  'api.minhaxbz.com.br',
  'minhaxbz.com.br',
  // Azure CDN usado pelo XBZ (cdndeprodutos = CDN de produtos em PT)
  'cdndeprodutos.azureedge.net',
  // Asia Import — 7.5% das imagens
  'asiaimport.com.br',
  'www.asiaimport.com.br',
  // Só Marcas — 2.0% das imagens
  'somarcas.com.br',
  'www.somarcas.com.br',
]);

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

/**
 * Retorna a URL proxiada se o domínio requer proxy, senão retorna a original.
 * Usa Set.has() para O(1) lookup vs Array.includes() O(n).
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
//
// Fallback de baixo custo quando url_original não está no objeto Product
// (que carrega apenas CF URLs em images[]). Usado pelo OptimizedImage quando
// a imagem do Cloudflare falha, ANTES de mostrar o ícone de erro.

const SPOT_ORIGIN_BASE = 'https://www.spotgifts.com.br/fotos/produtos/';

/**
 * Tenta derivar a url_original do fornecedor a partir da URL CDN do Cloudflare.
 * Retorna null quando o padrão não é reconhecido (sem fallback → mostra ícone).
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
