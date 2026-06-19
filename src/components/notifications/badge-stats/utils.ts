import type { RatioSample } from './useNotificationsMetricsPanel';

import { logger } from '@/lib/logger';
/**
 * Build the SVG `points` string for a polyline that fits the samples in a
 * `width × height` box. Returns an empty string if there's nothing to draw.
 */
export function buildSparkPath(
  samples: RatioSample[],
  width: number,
  height: number,
  windowSeconds: number,
): string {
  if (samples.length === 0) return '';
  const n = windowSeconds;
  // X-axis: index 0 = oldest, index n-1 = newest. Right-align so newest sits
  // at the right edge regardless of how many samples we have.
  const stepX = width / (n - 1);
  const startIdx = n - samples.length;
  return samples
    .map((s, i) => {
      const x = (startIdx + i) * stepX;
      // Ratio is bounded [0..∞) but practically [0..1+]. Clamp display to 1.
      const y = height - Math.min(1, s.ratio) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

/**
 * Color the trigger/fetch ratio based on coalescing efficiency:
 *   - <0.3 = excellent (most triggers absorbed by debounce + 5s TTL)
 *   - 0.3..0.7 = healthy
 *   - >0.7 = suspicious (debounce/TTL not coalescing — investigate)
 */
export function ratioTone(ratio: number, triggers: number): string {
  if (triggers === 0) return 'text-muted-foreground';
  if (ratio < 0.3) return 'text-primary';
  if (ratio < 0.7) return 'text-foreground';
  return 'text-warning';
}

export function fmtMs(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  if (v < 1) return '<1ms';
  if (v < 1000) return `${Math.round(v)}ms`;
  return `${(v / 1000).toFixed(2)}s`;
}

export function fmtAge(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60_000)}m`;
}

/** Trigger a JSON Blob download. */
export const downloadJson = (filenameStem: string, payload: unknown) => {
  try {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filenameStem}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Defer revoke so Safari has a tick to honor the download.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    logger.error('[NotificationsBadgeStatsPanel] export failed', err);
  }
};
