/**
 * Hook React para observar o status do Lovable Cloud.
 *
 * Polling adaptativo:
 *   - `healthy`            → re-checa a cada 60s
 *   - `warming`/`degraded` → re-checa em 5s, 10s, 15s (cap 15s)
 *   - `down`               → para automático após 30s; usuário aciona retry
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  probeCloudStatus,
  onCloudStatusChange,
  getCachedCloudStatus,
  type CloudStatus,
  type CloudStatusSnapshot,
} from '@/lib/cloud-status';

interface UseCloudStatusReturn {
  status: CloudStatus;
  snapshot: CloudStatusSnapshot | null;
  retry: () => Promise<void>;
  isChecking: boolean;
}

const HEALTHY_INTERVAL = 60_000;
const DEGRADED_BACKOFF = [5_000, 10_000, 15_000];
const DOWN_AUTO_STOP_MS = 30_000;

export function useCloudStatus(): UseCloudStatusReturn {
  const initial = getCachedCloudStatus();
  const [snapshot, setSnapshot] = useState<CloudStatusSnapshot | null>(initial);
  const [isChecking, setIsChecking] = useState(false);
  const downSinceRef = useRef<number | null>(null);
  const degradedAttemptRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const runProbe = useCallback(async (force: boolean) => {
    setIsChecking(true);
    try {
      const snap = await probeCloudStatus(force);
      setSnapshot(snap);
      return snap;
    } finally {
      setIsChecking(false);
    }
  }, []);

  const schedule = useCallback((snap: CloudStatusSnapshot) => {
    clearTimer();
    if (snap.status === 'healthy') {
      degradedAttemptRef.current = 0;
      downSinceRef.current = null;
      timerRef.current = setTimeout(() => void runProbe(false), HEALTHY_INTERVAL);
      return;
    }
    if (snap.status === 'down') {
      if (downSinceRef.current === null) downSinceRef.current = Date.now();
      const elapsed = Date.now() - (downSinceRef.current ?? Date.now());
      if (elapsed >= DOWN_AUTO_STOP_MS) return; // aguarda retry manual
      timerRef.current = setTimeout(() => void runProbe(true), 5_000);
      return;
    }
    // warming | degraded
    downSinceRef.current = null;
    const idx = Math.min(degradedAttemptRef.current, DEGRADED_BACKOFF.length - 1);
    const delay = DEGRADED_BACKOFF[idx];
    degradedAttemptRef.current++;
    timerRef.current = setTimeout(() => void runProbe(true), delay);
  }, [runProbe]);

  // Bootstrap + listener de mudanças globais.
  useEffect(() => {
    let cancelled = false;
    void runProbe(false).then((snap) => {
      if (!cancelled) schedule(snap);
    });
    const off = onCloudStatusChange((snap) => {
      if (cancelled) return;
      setSnapshot(snap);
      schedule(snap);
    });
    return () => {
      cancelled = true;
      off();
      clearTimer();
    };
  }, [runProbe, schedule]);

  const retry = useCallback(async () => {
    degradedAttemptRef.current = 0;
    downSinceRef.current = null;
    const snap = await runProbe(true);
    schedule(snap);
  }, [runProbe, schedule]);

  return {
    status: snapshot?.status ?? 'unknown',
    snapshot,
    retry,
    isChecking,
  };
}
