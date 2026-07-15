/**
 * navigationMetrics — Instrumentação leve de navegação/Web Vitals sem depender
 * da lib `web-vitals`. Usa APIs nativas (PerformanceObserver,
 * PerformanceNavigationTiming, Layout Shift API, longtask).
 *
 * Métricas coletadas:
 *   - ttfb           (PerformanceNavigationTiming.responseStart)
 *   - dom_interactive (domInteractive - startTime)
 *   - dom_complete    (domComplete - startTime)
 *   - cls            (soma de layout-shifts sem interação do usuário)
 *   - tti_approx     (heurística: `domInteractive` + primeira janela ≥ 5s sem longtask)
 *   - route_change   (ms entre location.pathname mudar e rAF pós-commit)
 *
 * Envio: Sentry.captureMessage('nav.metric', { tags:{ route, device, metric }, extra:{...} }).
 * Sample rate: 10% (configurável via VITE_NAV_METRICS_SAMPLE_RATE).
 *
 * Flag:
 *   VITE_ENABLE_NAV_METRICS: 'true' | 'false' — default 'true' em prod, 'false' em dev.
 *   localStorage.setItem('nav_metrics_disabled','1') — kill-switch por navegador.
 *
 * Métricas emitidas antes do Sentry carregar ficam bufferizadas e são
 * flushadas quando `captureMessage` estiver disponível.
 *
 * Uso: chamar `initNavigationMetrics()` uma única vez em `main.tsx` após
 * `initSentry()`. `notifyRouteChange(pathname)` é chamado por RouteScrollReset.
 */
import { captureMessage } from '@/lib/sentry';

type MetricName =
  'cls' | 'dom_complete' | 'dom_interactive' | 'route_change' | 'ttfb' | 'tti_approx';

interface MetricEvent {
  metric: MetricName;
  value: number;
  route: string;
  device: 'desktop' | 'mobile';
  rating?: 'good' | 'needs-improvement' | 'poor';
}

const BUFFER: MetricEvent[] = [];
const BUFFER_MAX = 40;
let started = false;
let clsValue = 0;
let ttiTimer: ReturnType<typeof setTimeout> | null = null;
let ttiReported = false;

function isEnabled(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    if (window.localStorage?.getItem('nav_metrics_disabled') === '1') return false;
    const flag = import.meta.env.VITE_ENABLE_NAV_METRICS;
    if (flag === 'false') return false;
    if (flag === 'true') return true;
    return !import.meta.env.DEV;
  } catch {
    return false;
  }
}

function sampleRate(): number {
  const raw = import.meta.env.VITE_NAV_METRICS_SAMPLE_RATE;
  const n = raw ? Number(raw) : 0.1;
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : 0.1;
}

/** Normaliza IDs numéricos/UUIDs em `:id` para agrupar rotas no Sentry. */
export function normalizeRoute(pathname: string): string {
  return pathname
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/\d{2,}/g, '/:id')
    .replace(/\/[A-Za-z0-9_-]{16,}/g, '/:id');
}

function currentDevice(): 'desktop' | 'mobile' {
  try {
    return window.matchMedia?.('(max-width: 768px)').matches ? 'mobile' : 'desktop';
  } catch {
    return 'desktop';
  }
}

function rateWebVital(metric: MetricName, value: number): MetricEvent['rating'] {
  // Thresholds oficiais (docs/PERFORMANCE.md).
  if (metric === 'ttfb') return value <= 800 ? 'good' : value <= 1800 ? 'needs-improvement' : 'poor';
  if (metric === 'cls') return value <= 0.1 ? 'good' : value <= 0.25 ? 'needs-improvement' : 'poor';
  if (metric === 'tti_approx' || metric === 'dom_interactive')
    return value <= 2500 ? 'good' : value <= 4000 ? 'needs-improvement' : 'poor';
  if (metric === 'route_change')
    return value <= 200 ? 'good' : value <= 500 ? 'needs-improvement' : 'poor';
  return undefined;
}

function emit(ev: MetricEvent): void {
  if (Math.random() > sampleRate()) return;
  if (BUFFER.length >= BUFFER_MAX) BUFFER.shift();
  BUFFER.push(ev);
  flushBuffer();
}

function flushBuffer(): void {
  if (BUFFER.length === 0) return;
  const drain = BUFFER.splice(0, BUFFER.length);
  for (const ev of drain) {
    try {
      captureMessage(`nav.metric.${ev.metric}`, 'info', {
        route: ev.route,
        device: ev.device,
        metric: ev.metric,
        value: Math.round(ev.value * 1000) / 1000,
        rating: ev.rating ?? 'unknown',
      });
    } catch {
      /* Sentry ainda não carregou — próximo flush resolve. */
    }
  }
}

function record(metric: MetricName, value: number, route?: string): void {
  const r = normalizeRoute(route ?? window.location.pathname);
  emit({
    metric,
    value,
    route: r,
    device: currentDevice(),
    rating: rateWebVital(metric, value),
  });
}

function observeNavigationTiming(): void {
  const entries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
  const nav = entries[0];
  if (!nav) return;
  record('ttfb', nav.responseStart);
  record('dom_interactive', nav.domInteractive - nav.startTime);
  record('dom_complete', nav.domComplete - nav.startTime);
}

function observeCLS(): void {
  if (typeof PerformanceObserver === 'undefined') return;
  try {
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as PerformanceEntry[]) {
        const e = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
        if (!e.hadRecentInput && typeof e.value === 'number') clsValue += e.value;
      }
    });
    po.observe({ type: 'layout-shift', buffered: true } as PerformanceObserverInit);

    const flush = () => {
      if (document.visibilityState === 'hidden' && clsValue > 0) {
        record('cls', clsValue);
        clsValue = 0;
      }
    };
    document.addEventListener('visibilitychange', flush, { once: false });
    window.addEventListener('pagehide', () => {
      if (clsValue > 0) record('cls', clsValue);
    }, { once: true });
  } catch {
    /* Some UAs sem suporte à API — ignore. */
  }
}

function observeTTI(): void {
  if (typeof PerformanceObserver === 'undefined') return;
  const IDLE_WINDOW = 5000;
  let lastLongtaskAt = performance.now();

  const scheduleReport = () => {
    if (ttiReported) return;
    if (ttiTimer) clearTimeout(ttiTimer);
    ttiTimer = setTimeout(() => {
      if (ttiReported) return;
      ttiReported = true;
      const nav = (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined);
      const base = nav?.domInteractive ?? 0;
      const tti = Math.max(lastLongtaskAt - (nav?.startTime ?? 0), base);
      record('tti_approx', tti);
    }, IDLE_WINDOW);
  };

  try {
    const po = new PerformanceObserver((list) => {
      for (const _ of list.getEntries()) {
        lastLongtaskAt = performance.now();
      }
      scheduleReport();
    });
    po.observe({ type: 'longtask', buffered: true } as PerformanceObserverInit);
    scheduleReport();
  } catch {
    /* longtask não suportado (Safari) — ignore. */
  }
}

// ── Route change timing ──────────────────────────────────────────────────────
let routeChangeStart: number | null = null;
let lastPath: string | null = null;

export function notifyRouteChange(pathname: string): void {
  if (!started) return;
  if (lastPath === pathname) return;
  const prev = lastPath;
  lastPath = pathname;
  if (prev === null) return; // primeira renderização não é troca de rota.

  routeChangeStart = performance.now();
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      // eslint-disable-next-line eqeqeq, no-eq-null -- checagem intencional de null/undefined
      if (routeChangeStart == null) return;
      const duration = performance.now() - routeChangeStart;
      routeChangeStart = null;
      record('route_change', duration, pathname);
    });
  });
}

export function initNavigationMetrics(): void {
  if (started) return;
  if (!isEnabled()) return;
  started = true;
  lastPath = typeof window !== 'undefined' ? window.location.pathname : null;

  const run = () => {
    observeNavigationTiming();
    observeCLS();
    observeTTI();
  };

  if (document.readyState === 'complete') {
    run();
  } else {
    window.addEventListener('load', () => setTimeout(run, 0), { once: true });
  }
}

// Test-only reset helper (não importar em runtime).
export function __resetForTests(): void {
  BUFFER.length = 0;
  started = false;
  clsValue = 0;
  ttiReported = false;
  routeChangeStart = null;
  lastPath = null;
  if (ttiTimer) clearTimeout(ttiTimer);
  ttiTimer = null;
}
