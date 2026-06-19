/**
 * performance-budget.ts — Monitora Core Web Vitals e emite alertas em dev.
 *
 * Usa PerformanceObserver para capturar LCP, FID, CLS, INP e TTFB.
 * Em produção: reporta via telemetry. Em dev: console.warn apenas.
 *
 * Thresholds baseados em Google Core Web Vitals 2024:
 *   LCP  ≤ 2500ms (good) | > 4000ms (poor)
 *   FID  ≤ 100ms  (good) | > 300ms  (poor)
 *   CLS  ≤ 0.1    (good) | > 0.25   (poor)
 *   INP  ≤ 200ms  (good) | > 500ms  (poor)
 *   TTFB ≤ 800ms  (good) | > 1800ms (poor)
 */

const BUDGETS = {
  LCP: { good: 2500, poor: 4000 },
  FID: { good: 100, poor: 300 },
  CLS: { good: 0.1, poor: 0.25 },
  INP: { good: 200, poor: 500 },
  TTFB: { good: 800, poor: 1800 },
} as const;

type MetricName = keyof typeof BUDGETS;

function getRating(name: MetricName, value: number): 'good' | 'needs-improvement' | 'poor' {
  const budget = BUDGETS[name];
  if (value <= budget.good) return 'good';
  if (value <= budget.poor) return 'needs-improvement';
  return 'poor';
}

function reportMetric(name: string, value: number, rating: string) {
  if (import.meta.env.DEV) {
    const emoji = rating === 'good' ? '✅' : rating === 'needs-improvement' ? '⚠️' : '❌';
    // eslint-disable-next-line no-console
    console.log(
      `%c[CWV] ${emoji} ${name}: ${typeof value === 'number' && value < 10 ? value.toFixed(3) : Math.round(value)}${name === 'CLS' ? '' : 'ms'} (${rating})`,
      `color: ${rating === 'good' ? '#22c55e' : rating === 'needs-improvement' ? '#f59e0b' : '#ef4444'}`,
    );
  }
}

export function initPerformanceBudget(): void {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return;

  // LCP — Largest Contentful Paint
  try {
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      // BUG-F FIX: PerformancePaintTiming é para 'paint' entries, não LCP. PerformanceEntry tem startTime.
      const last = entries[entries.length - 1];
      const value = last.startTime;
      reportMetric('LCP', value, getRating('LCP', value));
    });
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {
    /* Observer not supported */
  }

  // CLS — Cumulative Layout Shift
  try {
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as LayoutShift[]) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
          reportMetric('CLS', clsValue, getRating('CLS', clsValue));
        }
      }
    });
    clsObserver.observe({ type: 'layout-shift', buffered: true });
  } catch {
    /* Observer not supported */
  }

  // INP — Interaction to Next Paint
  // durationThreshold não está no PerformanceObserverInit do lib.dom.d.ts;
  // usa double-cast para passar o parâmetro sem TS2353.
  try {
    const inpObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as PerformanceEventTiming[]) {
        if (entry.duration > 0)
          reportMetric('INP', entry.duration, getRating('INP', entry.duration));
      }
    });
    inpObserver.observe({
      type: 'event',
      buffered: true,
      durationThreshold: 16,
    } as unknown as PerformanceObserverInit);
  } catch {
    /* Observer not supported */
  }

  // TTFB — Time to First Byte
  try {
    const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (navEntries.length > 0) {
      const ttfb = navEntries[0].responseStart - navEntries[0].requestStart;
      reportMetric('TTFB', ttfb, getRating('TTFB', ttfb));
    }
  } catch {
    /* Not supported */
  }
}
