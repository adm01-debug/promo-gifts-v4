/**
 * Token Revocation — check defensivo contra sessões expulsas que ainda têm
 * JWT válido (default Supabase ~1h).
 *
 * Onda 15 / item 6.2 da auditoria pré-prod (10/mai/2026).
 *
 * Contexto:
 * - Existe a infra: tabela `user_token_revocations` (user_id, revoked_at),
 *   RPC `revoke_all_user_tokens(_user_id)`, e edge `force-global-logout`.
 * - Quando admin força logout global, novos logins recebem JWT novo (iat > revoked_at).
 * - Mas o JWT antigo do device do usuário continua válido até expirar.
 * - Este helper compara `iat` do JWT com `revoked_at` da tabela e bloqueia se
 *   o token foi emitido ANTES da revogação.
 *
 * Performance:
 * - Cache em memória por user_id com TTL 30s (cada Deno isolate tem seu próprio).
 * - Tradeoff: ataque tem janela máxima de 30s, mas DB não vira gargalo.
 *
 * Falhas:
 * - DB error → fail-open (não bloqueia). Defesa em profundidade — o token JWT já
 *   foi validado por `getUser()`, então este é um check adicional. Falhar em ler
 *   a tabela de revogações não deve quebrar produção inteira.
 * - JWT sem `iat` → fail-open (improvável; getUser já garantiu validade).
 */

import type { SupabaseClient } from "npm:@supabase/supabase-js@2.49.4";

interface RevocationCacheEntry {
  /** Timestamp da última revogação em ms (epoch). null se nunca revogado. */
  revokedAtMs: number | null;
  /** Quando esta entrada foi buscada do DB. */
  cachedAtMs: number;
}

const CACHE_TTL_MS = 30_000; // 30s — balança entre segurança e perf
const cache = new Map<string, RevocationCacheEntry>();

/**
 * Decodifica payload JWT (parte central) sem validar assinatura.
 * Validação de assinatura é feita pelo Supabase `getUser()` antes deste check.
 * Retorna `null` se o token não é parseável.
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    // base64url → base64
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    // padding
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Extrai `iat` (issued at) do JWT em segundos UNIX.
 * Retorna `null` se ausente ou inválido.
 */
export function getTokenIssuedAt(token: string): number | null {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  const iat = payload.iat;
  if (typeof iat !== "number" || iat <= 0) return null;
  return iat;
}

/**
 * Checa se o token JWT foi revogado (emitido antes de uma revogação registrada).
 *
 * @param supabaseAdmin Cliente com service_role para bypassar RLS na leitura.
 * @param userId UUID do usuário (de `getUser()`).
 * @param token JWT bruto (sem "Bearer ").
 * @returns true se revogado, false se válido.
 */
export async function isTokenRevoked(
  supabaseAdmin: SupabaseClient,
  userId: string,
  token: string,
): Promise<boolean> {
  const iatSec = getTokenIssuedAt(token);
  if (iatSec === null) {
    // Sem iat → não dá pra comparar. Fail-open (getUser já validou autenticidade).
    return false;
  }

  const tokenIssuedAtMs = iatSec * 1000;
  const now = Date.now();
  let revokedAtMs: number | null;

  const cached = cache.get(userId);
  if (cached && now - cached.cachedAtMs < CACHE_TTL_MS) {
    revokedAtMs = cached.revokedAtMs;
  } else {
    const { data, error } = await supabaseAdmin
      .from("user_token_revocations")
      .select("revoked_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      // Fail-open: defesa em profundidade, não vamos quebrar prod.
      console.error("[token-revocation] DB error:", error.message);
      return false;
    }

    revokedAtMs = data?.revoked_at ? new Date(data.revoked_at).getTime() : null;
    cache.set(userId, { revokedAtMs, cachedAtMs: now });
  }

  if (revokedAtMs === null) return false;
  return revokedAtMs > tokenIssuedAtMs;
}

/**
 * Limpa entrada do cache para um usuário (ou todo o cache).
 * Útil em testes e quando uma revogação acabou de ser registrada e queremos
 * que o próximo request veja imediatamente.
 */
export function clearRevocationCache(userId?: string): void {
  if (userId) cache.delete(userId);
  else cache.clear();
}

/**
 * @internal Apenas para testes.
 */
export function getCacheStats(): { size: number } {
  return { size: cache.size };
}
