/**
 * Proxy de imagens externas para evitar CORS
 * Reescreve URLs de domínios bloqueados para passar pelo edge function proxy
 */

const PROXIED_DOMAINS = [
  'www.spotgifts.com.br',
  'spotgifts.com.br',
];

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
// Usado como fallback de baixo custo quando url_original não está disponível
// no objeto Product (que carrega apenas CF URLs em images[]).

const SPOT_ORIGIN_BASE = 'https://www.spotgifts.com.br/fotos/produtos/';

/**
 * Tenta derivar a url_original de um fornecedor a partir da URL CDN do Cloudflare.
 * Retorna null quando o padrão não é reconhecido.
 *
 * Cenários cobertos:
 *   CF URL  → `https://imagedelivery.net/{hash}/spot-{ref}_{color}/public`
 *   CF URL  → `https://imagedelivery.net/{hash}/spot-{ref}_{color}/card`   (variante)
 *   Retorna → `https://www.spotgifts.com.br/fotos/produtos/{ref}_{color}.jpg`
 */
export function deriveOriginalUrl(cfUrl: string | null | undefined): string | null {
  if (!cfUrl) return null;

  try {
    // Só atua em URLs do CF Images
    if (!cfUrl.includes('imagedelivery.net')) return null;

    // Extrai o CF image ID (penúltimo segmento)
    const parts = cfUrl.split('/');
    // Estrutura: ['https:', '', 'imagedelivery.net', '{hash}', '{id}', '{variant}']
    if (parts.length < 5) return null;
    const cfId = parts[parts.length - 2]; // ex: "spot-11103_103"

    // ── SPOT ──────────────────────────────────────────────────────────────────────────────
    // CF ID: spot-{ref}_{color}  (ex: spot-11103_103, spot-92365_131)
    // Exclui tipos especiais: spot-{ref}_set, spot-{ref}_box, spot-{ref}_amb, spot-{ref}_pouch
    // Exclui picotados: spot-area-*, spot-pa-*
    if (cfId.startsWith('spot-') && !cfId.startsWith('spot-area-') && !cfId.startsWith('spot-pa-')) {
      const withoutPrefix = cfId.slice(5); // remove "spot-"
      // Verificar que é um padrão {ref}_{color} (sem sufixos de tipo)
      const typeSpecific = ['_set', '_box', '_amb', '_pouch', '-b', '-c', '-d', '-e', '-f', '-g'];
      const hasTypeSuffix = typeSpecific.some(s => withoutPrefix.endsWith(s));
      if (!hasTypeSuffix && withoutPrefix.includes('_')) {
        return `${SPOT_ORIGIN_BASE}${withoutPrefix}.jpg`;
      }
    }

    // Outros fornecedores: sem padrão derivável de forma confiável
    return null;
  } catch {
    return null;
  }
}
