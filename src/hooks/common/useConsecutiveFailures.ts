import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { OverviewRow } from "@/hooks/useConnectionsOverview";

export interface ConsecutiveFailureInfo {
  count: number;
  since: string | null;
}

interface ServerItem {
  key: string;
  consecutive_failures: number;
  since: string | null;
}

/**
 * Busca, via edge function `connection-tester` (action `consecutive_failures_overview`),
 * a contagem de falhas consecutivas por conexão, indexada pela mesma `key` usada em
 * `OverviewRow.key`. Re-fetcha sempre que o conjunto de chaves de `rows` muda e a
 * cada `pollMs` (default 30s — alinhado ao polling do overview).
 */
export function useConsecutiveFailures(rows: OverviewRow[], pollMs = 30000) {
  const [map, setMap] = useState<Map<string, ConsecutiveFailureInfo>>(new Map());
  const [loading, setLoading] = useState(false);
  const cancelRef = useRef(false);

  // Derived signature: trigger refetch when row identity set changes.
  const keysSig = rows.map((r) => r.key).sort().join("|");

  const fetchOnce = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("connection-tester", {
        body: { action: "consecutive_failures_overview", type: "supabase" },
      });
      if (cancelRef.current) return;
      if (error || !data?.items) {
        // Silencioso: coluna mostra "—" quando ausente.
        return;
      }
      const next = new Map<string, ConsecutiveFailureInfo>();
      for (const item of data.items as ServerItem[]) {
        next.set(item.key, { count: item.consecutive_failures, since: item.since });
      }
      setMap(next);
    } catch {
      // ignore
    } finally {
      if (!cancelRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    cancelRef.current = false;
    if (rows.length === 0) {
      setMap(new Map());
      return () => { cancelRef.current = true; };
    }
    fetchOnce();
    return () => { cancelRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keysSig, fetchOnce]);

  useEffect(() => {
    if (pollMs <= 0 || rows.length === 0) return;
    const id = setInterval(() => { fetchOnce(); }, pollMs);
    return () => clearInterval(id);
  }, [pollMs, rows.length, fetchOnce]);

  return { map, loading, refresh: fetchOnce };
}
