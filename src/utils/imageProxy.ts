/**
 * Proxy de imagens externas para evitar CORS
 * Reescreve URLs de domínios bloqueados para passar pelo edge function proxy
 */

const PROXIED_DOMAINS = ['www.spotgifts.com.br', 'spotgifts.com.br'];

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

/**
 * Retorna a URL proxiada se o domínio requer proxy, senão retorna a original
 */
export function getProxiedImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    if (PROXIED_DOMAINS.includes(parsed.hostname)) {
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
    return PROXIED_DOMAINS.includes(parsed.hostname);
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
const PROMO_GIFTS_IMAGES_WORKER_HOST = 'promo-brindes-images.adm01.workers.dev';

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

/**
 * Worker legado de imagens SPOT:
 *   https://promo-brindes-images.adm01.workers.dev/spot/{arquivo}
 *
 * Quando o worker retorna 404 para uma variante, a origem oficial da Spot
 * frequentemente ainda possui o arquivo. Usamos a origem como fallback
 * imediato para evitar cards quebrados.
 */
export function deriveSpotOriginalUrlFromWorker(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== PROMO_GIFTS_IMAGES_WORKER_HOST) return null;
    const match = parsed.pathname.match(/^\/spot\/([^/?#]+\.(?:jpe?g|png|webp))$/i);
    if (!match?.[1]) return null;
    return `${SPOT_ORIGIN_BASE}${match[1]}`;
  } catch {
    return null;
  }
}
