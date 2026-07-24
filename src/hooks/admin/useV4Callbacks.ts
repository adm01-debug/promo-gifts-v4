/**
 * useV4Callbacks — leitura + agregação de eventos crm_callback_events
 * ------------------------------------------------------------------
 * Alimenta o painel /admin/v4-callbacks com:
 *   - lista filtrável (external_quote_id, event_type, result, período)
 *   - séries agregadas para os gráficos (sent_ok / failed / exhausted)
 *   - exportação CSV
 *   - reprocesso de dead-letters via edge function `crm-callback-reprocess`
 *
 * Fonte de dados: banco canônico (`crm_callback_events`) via cliente
 * Supabase padrão do projeto (`@/integrations/supabase/client`).
 */
import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type CallbackResult = string | 'applied' | 'duplicate_ignored' | 'error' | 'exhausted';
export type EventType = 'approved' | 'expired' | 'order_created' | 'rejected' | 'sent_to_client';

export interface CallbackEventRow {
  id: string;
  external_quote_id: string;
  crm_quote_id: string | null;
  event_type: EventType;
  occurred_at: string;
  created_at: string;
  result: CallbackResult;
  error_message: string | null;
  payload: Record<string, unknown> | null;
}

export interface CallbackFilters {
  externalQuoteId?: string;
  eventType?: EventType | 'all';
  result?: CallbackResult | 'all';
  /** ISO string; default = now - 24h */
  since?: string;
  /** hard limit; default 1000 */
  limit?: number;
}

const DEFAULT_LIMIT = 1000;

function computeSince(sinceParam?: string): string {
  if (sinceParam) return sinceParam;
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}

export function useV4Callbacks(filters: CallbackFilters) {
  const since = computeSince(filters.since);
  const limit = filters.limit ?? DEFAULT_LIMIT;

  return useQuery({
    queryKey: ['v4-callbacks', filters, since, limit],
    queryFn: async (): Promise<CallbackEventRow[]> => {
      // NOTE: `crm_callback_events` vive no banco canônico e não está no types.ts
      // gerado (que reflete pqp). Cast via any até regenerar tipos do canônico.
      type QB = {
        select: (c: string) => QB;
        gte: (col: string, val: string) => QB;
        order: (col: string, opts: { ascending: boolean }) => QB;
        limit: (n: number) => QB;
        eq: (col: string, val: string) => QB;
        then: Promise<{ data: CallbackEventRow[] | null; error: unknown }>['then'];
      };
      const client = supabase as unknown as { from: (t: string) => QB };
      let q = client
        .from('crm_callback_events')
        .select(
          'id, external_quote_id, crm_quote_id, event_type, occurred_at, created_at, result, error_message, payload',
        )
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (filters.externalQuoteId?.trim()) {
        q = q.eq('external_quote_id', filters.externalQuoteId.trim());
      }
      if (filters.eventType && filters.eventType !== 'all') {
        q = q.eq('event_type', filters.eventType);
      }
      if (filters.result && filters.result !== 'all') {
        q = q.eq('result', filters.result);
      }
      const { data, error } = await q;
      if (error)
        throw new Error(
          typeof error === 'object' && error !== null && 'message' in error
            ? String((error as { message?: unknown }).message)
            : String(error),
        );
      return (data ?? []) as CallbackEventRow[];
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

/** Agrega em buckets temporais para os gráficos */
export interface TimeBucket {
  bucket: string; // ISO hora
  sent_ok: number;
  failed: number;
  exhausted: number;
  duplicate: number;
  total: number;
}

export function useCallbackBuckets(
  rows: CallbackEventRow[] | undefined,
  granularity: 'day' | 'hour' = 'hour',
): TimeBucket[] {
  return useMemo(() => {
    if (!rows?.length) return [];
    const bucketMs = granularity === 'hour' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const map = new Map<number, TimeBucket>();
    for (const r of rows) {
      const t = new Date(r.created_at).getTime();
      const key = Math.floor(t / bucketMs) * bucketMs;
      const iso = new Date(key).toISOString();
      const b: TimeBucket = map.get(key) ?? {
        bucket: iso,
        sent_ok: 0,
        failed: 0,
        exhausted: 0,
        duplicate: 0,
        total: 0,
      };
      b.total += 1;
      if (r.result === 'applied') b.sent_ok += 1;
      else if (r.result === 'exhausted') b.exhausted += 1;
      else if (r.result === 'duplicate_ignored') b.duplicate += 1;
      else b.failed += 1;
      map.set(key, b);
    }
    return Array.from(map.values()).sort((a, b) => a.bucket.localeCompare(b.bucket));
  }, [rows, granularity]);
}

/** Exporta CSV do subset atualmente filtrado */
export function toCSV(rows: CallbackEventRow[]): string {
  const header = [
    'id',
    'external_quote_id',
    'crm_quote_id',
    'event_type',
    'result',
    'occurred_at',
    'created_at',
    'error_message',
  ];
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.external_quote_id,
        r.crm_quote_id ?? '',
        r.event_type,
        r.result,
        r.occurred_at,
        r.created_at,
        r.error_message ?? '',
      ]
        .map(escape)
        .join(','),
    );
  }
  return lines.join('\n');
}

export function downloadCSV(rows: CallbackEventRow[], filename = 'v4-callbacks.csv') {
  const blob = new Blob([toCSV(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Reprocessa uma dead-letter (result=error) via edge function */
export function useReprocessCallback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (eventId: string) => {
      const { data, error } = await supabase.functions.invoke('crm-callback-reprocess', {
        body: { event_id: eventId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['v4-callbacks'] });
    },
  });
}

/** Reprocessa em lote todas as dead-letters visíveis com filtros aplicados */
export function useReprocessMany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { external_quote_id?: string; since?: string }) => {
      const { data, error } = await supabase.functions.invoke('crm-callback-reprocess', {
        body: { batch: true, ...payload },
      });
      if (error) throw error;
      return data as { processed: number; success: number; failed: number };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['v4-callbacks'] });
    },
  });
}
