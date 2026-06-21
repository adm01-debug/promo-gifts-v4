import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ConnectionType, ErrorKind } from '@/hooks/intelligence/useConnectionTester';
import { inferErrorKind } from '@/lib/error-kind-inference';

export interface TestDetails {
  id: string;
  tested_at: string;
  ok: boolean;
  triggered_by: 'cron' | 'manual' | 'webhook';
  triggered_by_user_email?: string | null;
  request: { method: string | null; url: string | null };
  response: {
    status: number | null;
    headers: Record<string, string> | null;
    body: string | null;
    truncated: boolean;
  };
  timing: {
    latency_ms: number | null;
    dns_ms: number | null;
    tcp_ms: number | null;
    tls_ms: number | null;
    ttfb_ms: number | null;
    download_ms: number | null;
  };
  error?: { kind: ErrorKind | null; message: string | null; timeout_ms?: number | null } | null;
}

interface Args {
  open: boolean;
  type: ConnectionType;
  envKey?: 'crm' | 'promobrind';
  connectionId?: string;
  /** Quando presente, busca este registro específico em vez do mais recente. */
  historyId?: string;
}

/**
 * Carrega o registro completo do último teste para uma conexão (ou de um teste específico via historyId).
 * Refaz a busca toda vez que `open` transita para true ou a chave composta muda.
 */
export function useConnectionTestDetails({ open, type, envKey, connectionId, historyId }: Args) {
  const [details, setDetails] = useState<TestDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqKey = `${type}:${historyId ?? envKey ?? connectionId ?? '*'}`;
  const lastKeyRef = useRef<string | null>(null);

  const fetchDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('connection-tester', {
        body: {
          action: 'last_test_full',
          type,
          env_key: envKey,
          connection_id: connectionId,
          id: historyId,
        },
      });
      if (invokeError) throw invokeError;
      const raw = (data?.details ?? null) as TestDetails | null;
      // Fallback: registros antigos podem ter `error.kind = null`. Inferimos o
      // kind a partir do error_message + status_code para que o badge semântico
      // apareça mesmo retroativamente.
      if (raw && !raw.ok && raw.error && !raw.error.kind) {
        raw.error.kind = inferErrorKind({
          errorKind: raw.error.kind ?? null,
          errorMessage: raw.error.message ?? null,
          statusCode: raw.response?.status ?? null,
          success: raw.ok,
        });
      }
      setDetails(raw);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
      setDetails(null);
    } finally {
      setLoading(false);
    }
  }, [type, envKey, connectionId, historyId]);

  useEffect(() => {
    if (!open) return;
    if (lastKeyRef.current !== reqKey) {
      // Chave mudou — reseta para evitar mostrar dados velhos
      setDetails(null);
    }
    lastKeyRef.current = reqKey;
    fetchDetails();
  }, [open, reqKey, fetchDetails]);

  return { details, loading, error, refetch: fetchDetails };
}
