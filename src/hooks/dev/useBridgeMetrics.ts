import { useState, useCallback, useSyncExternalStore } from 'react';
import {
  getBridgeSamples,
  subscribeBridgeCalls,
  clearBridgeSamples,
  type BridgeCallSample,
} from '@/lib/telemetry/bridgeCallMetrics';

export type BridgeMetricsFilter = {
  method?: string;
  minLatency?: number;
};

interface BridgeMetricsEntry {
  id: string;
  method: string;
  url: string;
  latency: number;
  status: number;
  responseSize: number;
  timestamp: number;
}

interface BridgeMetricsSummary {
  total: number;
  avg: number;
  totalResp: number;
  errors: number;
  last20: number;
}

interface BridgeMetricsReturn {
  entries: BridgeMetricsEntry[];
  summary: BridgeMetricsSummary;
  filter: BridgeMetricsFilter;
  setFilter: (f: BridgeMetricsFilter) => void;
  open: boolean;
  setOpen: (v: boolean) => void;
  clear: () => void;
}

function samplesToEntries(samples: readonly BridgeCallSample[]): BridgeMetricsEntry[] {
  return samples.map((s) => ({
    id: String(s.id),
    method: s.op,
    url: `${s.bridge}/${s.target ?? ''}`,
    latency: s.durationMs,
    status: s.status ?? (s.ok ? 200 : 500),
    responseSize: s.respBytes,
    timestamp: s.ts,
  }));
}

export function useBridgeMetrics(): BridgeMetricsReturn {
  const samples = useSyncExternalStore(subscribeBridgeCalls, getBridgeSamples, getBridgeSamples);
  const [filter, setFilter] = useState<BridgeMetricsFilter>({});
  const [open, setOpen] = useState(false);

  const entries = samplesToEntries(samples);

  const clear = useCallback(() => {
    clearBridgeSamples();
  }, []);

  const summary: BridgeMetricsSummary = {
    total: entries.length,
    avg:
      entries.length > 0
        ? Math.round(entries.reduce((s, e) => s + e.latency, 0) / entries.length)
        : 0,
    totalResp: entries.reduce((s, e) => s + e.responseSize, 0),
    errors: entries.filter((e) => e.status >= 400).length,
    last20: Math.min(entries.length, 20),
  };

  return { entries, summary, filter, setFilter, open, setOpen, clear };
}
