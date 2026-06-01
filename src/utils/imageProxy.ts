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
