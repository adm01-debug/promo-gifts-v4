/**
 * Health-check stub — Caminho B (PRs #230-232).
 *
 * A `external-db-bridge` foi descontinuada. Todas as queries agora vão
 * direto ao PostgREST nativo do Supabase. Manter chamadas à bridge geraria
 * erros 404/401 no console e bloquearia o prewarm desnecessariamente.
 *
 * Tanto `pingHealth()` quanto `waitForBridgeReady()` retornam ok=true
 * imediatamente — bridge aposentada ≠ falha de infra.
 *
 * Os tipos e exports públicos foram preservados para não quebrar importadores
 * (cloud-status.ts, external-db-prewarm.ts, useBridgeMetrics.ts, etc.).
 */

export type BridgeHealth = {
  ok: boolean;
  ms: number;
  status?: number;
  error?: string;
};

/**
 * @deprecated Caminho B — bridge descontinuada. Retorna ok=true imediatamente.
 * Mantido apenas para compatibilidade com importadores existentes.
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function pingHealth(_timeoutMs = 2500): Promise<BridgeHealth> {
  // external-db-bridge foi descontinuada nas PRs #230-232 (Caminho B).
  // Retornamos ok=true para não bloquear o cloud-status probe nem o prewarm.
  return { ok: true, ms: 0 };
}

/**
 * @deprecated Caminho B — bridge descontinuada. Retorna ok=true imediatamente.
 * Mantido apenas para compatibilidade com importadores existentes.
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function waitForBridgeReady(_totalTimeoutMs = 5000): Promise<BridgeHealth> {
  return { ok: true, ms: 0 };
}

/** Limpa o cache — mantido para compatibilidade com testes existentes. */
export function invalidateBridgeReadyCache(): void {
  // no-op: sem estado a limpar após aposentadoria da bridge.
}
