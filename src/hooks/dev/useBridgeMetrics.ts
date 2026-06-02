import { useState, useCallback } from 'react';

export interface BridgeMetricsFilter {
  method?: string;
  minLatency?: number;
}

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

export function useBridgeMetrics(): BridgeMetricsReturn {
  const [entries] = useState<BridgeMetricsEntry[]>([]);
  const [filter, setFilter] = useState<BridgeMetricsFilter>({});
  const [open, setOpen] = useState(false);

  const clear = useCallback(() => {}, []);

  const summary: BridgeMetricsSummary = {
    total: entries.length,
    avg: entries.length > 0 ? Math.round(entries.reduce((s, e) => s + e.latency, 0) / entries.length) : 0,
    totalResp: entries.reduce((s, e) => s + e.responseSize, 0),
    errors: entries.filter((e) => e.status >= 400).length,
    last20: Math.min(entries.length, 20),
  };

  return { entries, summary, filter, setFilter, open, setOpen, clear };
}
