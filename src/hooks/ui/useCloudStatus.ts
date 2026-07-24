/**
 * Hook React para observar o status do Lovable Cloud.
 *
 * Polling adaptativo:
 *   - `healthy`            → re-checa a cada 60s
 *   - `warming`/`degraded` → re-checa em 20s, 40s, 60s (cap 60s)
 *   - `down`               → para automático após 30s; usuário aciona retry
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CloudStatus, CloudStatusSnapshot } from '@/lib/cloud-status';
import { isSupabaseLighthousePlaceholder } from '@/lib/env/supabase-placeholder';

interface UseCloudStatusReturn {
  status: CloudStatus;
  snapshot: CloudStatusSnapshot | null;
  retry: () => Promise<void>;
  isChecking: boolean;
}

const HEALTHY_INTERVAL = 60_000;
// Backoff menos agressivo em degraded/warming. Cada probe dispara auth+rest com
// force=true (ignora o cache de 15s do cloud-status.ts); a cadência antiga de
// [5s,10s,15s] amplificava a carga sobre um backend já saturado, criando um loop
// de realimentação que prolongava o próprio estado degradado. [20s,40s,60s] corta
// ~4x a carga auto-infligida e ainda detecta recuperação em ~1 min.
const DEGRADED_BACKOFF = [20_000, 40_000, 60_000];
const DOWN_AUTO_STOP_MS = 30_000;
const loadCloudStatus = () => import('@/lib/cloud-status');

export function useCloudStatus(): UseCloudStatusReturn {
  const disabled = isSupabaseLighthousePlaceholder();
  const [snapshot, setSnapshot] = useState<CloudStatusSnapshot | null>(null);
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

  const runProbe = useCallback(
    async (force: boolean): Promise<CloudStatusSnapshot | null> => {
      if (disabled) return null;
      setIsChecking(true);
      try {
        const { probeCloudStatus } = await loadCloudStatus();
        const snap = await probeCloudStatus(force);
        setSnapshot(snap);
        return snap;
      } finally {
        setIsChecking(false);
      }
    },
    [disabled],
  );

  const schedule = useCallback(
    (snap: CloudStatusSnapshot | null) => {
      if (!snap) return;
      clearTimer();
      if (snap.status === 'healthy') {
        degradedAttemptRef.current = 0;
        downSinceRef.current = null;
        timerRef.current = setTimeout(() => {
          runProbe(false);
        }, HEALTHY_INTERVAL);
        return;
      }
      if (snap.status === 'down') {
        if (downSinceRef.current === null) downSinceRef.current = Date.now();
        const elapsed = Date.now() - (downSinceRef.current ?? Date.now());
        if (elapsed >= DOWN_AUTO_STOP_MS) return; // aguarda retry manual
        timerRef.current = setTimeout(() => {
          runProbe(true);
        }, 5_000);
        return;
      }
      // warming | degraded
      downSinceRef.current = null;
      const idx = Math.min(degradedAttemptRef.current, DEGRADED_BACKOFF.length - 1);
      const delay = DEGRADED_BACKOFF[idx];
      degradedAttemptRef.current++;
      timerRef.current = setTimeout(() => {
        runProbe(true);
      }, delay);
    },
    [runProbe],
  );

  // Bootstrap + listener de mudanças globais.
  useEffect(() => {
    if (disabled) {
      clearTimer();
      setSnapshot(null);
      setIsChecking(false);
      return;
    }

    let cancelled = false;
    let off: (() => void) | undefined;

    void loadCloudStatus().then(({ getCachedCloudStatus, onCloudStatusChange }) => {
      if (cancelled) return;
      setSnapshot(getCachedCloudStatus());
      void runProbe(false).then((snap) => {
        if (!cancelled) schedule(snap);
      });
      off = onCloudStatusChange((snap) => {
        if (cancelled) return;
        setSnapshot(snap);
        schedule(snap);
      });
    });

    return () => {
      cancelled = true;
      off?.();
      clearTimer();
    };
  }, [disabled, runProbe, schedule]);

  const retry = useCallback(async () => {
    if (disabled) return;
    degradedAttemptRef.current = 0;
    downSinceRef.current = null;
    const snap = await runProbe(true);
    schedule(snap);
  }, [disabled, runProbe, schedule]);

  return {
    status: snapshot?.status ?? 'unknown',
    snapshot,
    retry,
    isChecking,
  };
}
