/**
 * Gerador de request-id (correlation-id) para correlacionar uma chamada do
 * frontend com os logs das edge functions de bridge.
 *
 * - UUID v4 (crypto.randomUUID quando disponível, fallback compatível).
 * - Header padrão: `X-Request-Id`.
 *
 * Uso típico:
 *   const requestId = newRequestId();
 *   await supabase.functions.invoke('crm-db-bridge', {
 *     body, headers: { [REQUEST_ID_HEADER]: requestId },
 *   });
 *   recordBridgeCall({ ..., requestId });
 */

export const REQUEST_ID_HEADER = 'X-Request-Id';

export function newRequestId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  // Fallback RFC4122-ish para ambientes sem crypto.randomUUID.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = Math.floor(Math.random() * 16);
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Trunca um UUID p/ exibição compacta (mantém prefixo + sufixo). */
export function shortRequestId(id: string | null | undefined): string {
  if (!id) return '—';
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}
