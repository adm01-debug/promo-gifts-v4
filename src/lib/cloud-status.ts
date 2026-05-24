/**
 * Sondador unificado de status do backend Supabase.
 *
 * Combina 3 sinais para inferir um estado normalizado:
 *   1. `auth.getSession()`     → API de auth respondendo
 *   2. `pingHealth()`          → bridge externo (edge function) viva
 *   3. HEAD em `/rest/v1/`     → Postgres/PostgREST acessível
 *
 * Estados:
 *   - `healthy`   3/3 OK (mesmo com latência alta)
 *   - `warming`   2/3 OK
 *   - `degraded`  1/3 OK
 *   - `down`      0/3 OK
 *
 * Características:
 *   - Cache de 15s (resultado é compartilhado entre chamadas próximas).
 *   - Coalescing de chamadas paralelas (1 sondagem por vez).
 *   - EventTarget para broadcast — UI escuta via `onCloudStatusChange()`.
 */
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { pingHealth } from '@/lib/external-db/health-check';

export type CloudStatus = 'healthy' | 'warming' | 'degraded' | 'down' | 'unknown';

export interface CloudStatusSnapshot {
  status: CloudStatus;
  signals: {
    auth: { ok: boolean; ms: number };
    bridge: { ok: boolean; ms: number };
    rest: { ok: boolean; ms: number };
  };
  checkedAt: number;
}

const CACHE_MS = 15_000;
const PROBE_TIMEOUT_MS = 5000; // Increased from 2.5s to 5s to avoid false positives on cold starts

let cached: CloudStatusSnapshot | null = null;
let inFlight: Promise<CloudStatusSnapshot> | null = null;
let consecutiveFailures = 0;

export interface StatusHistoryEntry {
  status: CloudStatus;
  timestamp: number;
  consecutiveFailures: number;
}

const HISTORY_KEY = 'supabase_health_history';
const MAX_HISTORY_AGE_MS = 24 * 60 * 60 * 1000; // 24h

function getStatusHistory(): StatusHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const now = Date.now();
    return parsed.filter((e: StatusHistoryEntry) => now - e.timestamp < MAX_HISTORY_AGE_MS);
  } catch {
    return [];
  }
}

function saveStatusHistory(entry: StatusHistoryEntry) {
  try {
    const history = getStatusHistory();
    history.push(entry);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-100))); // Keep last 100
  } catch (error) {
    logger.warn('[CloudStatus] failed to persist status history', {
      HISTORY_KEY,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function getStatusTimeline() {
  return getStatusHistory();
}

const FAILURE_THRESHOLD = 2; // Need 2 consecutive full failures to go 'down'

const target: EventTarget =
  typeof EventTarget !== 'undefined'
    ? new EventTarget()
    : ({
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() {
          return true;
        },
      } as unknown as EventTarget);

const EVENT_NAME = 'cloud-status-change';

export class CloudNotReadyError extends Error {
  readonly code = 'CLOUD_NOT_READY' as const;
  readonly status: CloudStatus;
  constructor(status: CloudStatus, message?: string) {
    super(message ?? `Backend not ready (status=${status})`);
    this.name = 'CloudNotReadyError';
    this.status = status;
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

async function checkAuth(): Promise<{ ok: boolean; ms: number }> {
  const t0 = performance.now();
  try {
    const { error } = await withTimeout(supabase.auth.getSession(), PROBE_TIMEOUT_MS);
    // getSession might return session: null without error if no user is logged in, that's still "ok"
    return { ok: !error, ms: Math.round(performance.now() - t0) };
  } catch {
    return { ok: false, ms: Math.round(performance.now() - t0) };
  }
}

async function checkRest(): Promise<{ ok: boolean; ms: number }> {
  const t0 = performance.now();
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (!url || !key) return { ok: false, ms: 0 };
  try {
    const res = await withTimeout(
      fetch(`${url}/rest/v1/`, {
        method: 'HEAD',
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      }),
      PROBE_TIMEOUT_MS,
    );
    // PostgREST typically returns 200/404 for HEAD /
    return {
      ok: res.ok || res.status === 404 || res.status === 401,
      ms: Math.round(performance.now() - t0),
    };
  } catch {
    return { ok: false, ms: Math.round(performance.now() - t0) };
  }
}

function deriveStatus(signals: CloudStatusSnapshot['signals']): CloudStatus {
  const okSignals = [signals.auth.ok, signals.bridge.ok, signals.rest.ok];
  const okCount = okSignals.filter(Boolean).length;

  if (okCount === 3) {
    consecutiveFailures = 0;
    return 'healthy';
  }

  if (okCount === 2) {
    consecutiveFailures = 0;
    return 'warming';
  }

  if (okCount === 1) {
    consecutiveFailures = 0;
    return 'degraded';
  }

  // okCount === 0: Full failure detected
  consecutiveFailures++;

  // If we don't have enough consecutive failures yet, return 'degraded' instead of 'down'
  if (consecutiveFailures < FAILURE_THRESHOLD) {
    return 'degraded';
  }

  return 'down';
}

/**
 * Executa a sondagem (ou retorna cache válido).
 */
export async function probeCloudStatus(force = false): Promise<CloudStatusSnapshot> {
  if (!force && cached && Date.now() - cached.checkedAt < CACHE_MS) {
    return cached;
  }
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const [auth, bridgeRes, rest] = await Promise.all([
      checkAuth(),
      pingHealth(PROBE_TIMEOUT_MS).then((r) => ({ ok: r.ok, ms: r.ms })),
      checkRest(),
    ]);
    const signals = { auth, bridge: bridgeRes, rest };
    const newStatus = deriveStatus(signals);
    const snapshot: CloudStatusSnapshot = {
      status: newStatus,
      signals,
      checkedAt: Date.now(),
    };

    saveStatusHistory({
      status: snapshot.status,
      timestamp: snapshot.checkedAt,
      consecutiveFailures,
    });

    const previous = cached?.status;
    cached = snapshot;
    if (previous !== snapshot.status) {
      logger.warn(
        `[CloudStatus] state change ${previous ?? 'unknown'} → ${snapshot.status}`,
        signals,
      );
      target.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: snapshot }));
    }
    return snapshot;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

export function getCachedCloudStatus(): CloudStatusSnapshot | null {
  return cached;
}

export function onCloudStatusChange(cb: (snapshot: CloudStatusSnapshot) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<CloudStatusSnapshot>).detail);
  target.addEventListener(EVENT_NAME, handler);
  return () => target.removeEventListener(EVENT_NAME, handler);
}

export function invalidateCloudStatus(): void {
  cached = null;
}

/**
 * Gate: aguarda o backend ficar `healthy` (ou `warming`) antes de prosseguir.
 * Rejeita com `CloudNotReadyError` se persistir `degraded`/`down` após o orçamento.
 *
 * @param totalTimeoutMs orçamento total (default 8s)
 * @param acceptWarming se true, considera `warming` como pronto (default true — não bloqueia UX em cold start de isolate)
 */
export async function ensureCloudReady(
  totalTimeoutMs = 8000,
  acceptWarming = true,
): Promise<CloudStatusSnapshot> {
  const start = performance.now();
  let attempt = 0;
  let snap = await probeCloudStatus(false);

  const isReady = (s: CloudStatus) => s === 'healthy' || (acceptWarming && s === 'warming');

  while (!isReady(snap.status) && performance.now() - start < totalTimeoutMs) {
    attempt++;
    const delay = Math.min(1500, 200 * Math.pow(2, attempt - 1));
    if (performance.now() - start + delay >= totalTimeoutMs) break;
    await new Promise((r) => setTimeout(r, delay));
    snap = await probeCloudStatus(true);
  }

  if (!isReady(snap.status)) {
    throw new CloudNotReadyError(snap.status);
  }
  return snap;
}
