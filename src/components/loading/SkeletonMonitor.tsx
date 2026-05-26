import { useEffect, useRef, useState } from 'react';
import { logger } from '@/lib/logger';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { getSkeletonThreshold } from '@/config/skeleton.config';

interface SkeletonMonitorProps {
  name: string;
  children: React.ReactNode;
  thresholdMs?: number;
}

/**
 * Monitors how long a skeleton (loading state) stays mounted.
 * Logs performance metrics and shows a debug timer for Devs.
 */
export function SkeletonMonitor({
  name,
  children,
  thresholdMs: manualThresholdMs,
}: SkeletonMonitorProps) {
  const thresholdMs = manualThresholdMs || getSkeletonThreshold(name);
  const startTime = useRef<number>(performance.now());
  const [elapsed, setElapsed] = useState(0);
  const { isAdmin, isDev: isDevRole } = useAuth();
  const isDev = isAdmin || isDevRole;

  useEffect(() => {
    // Only track if we are in the browser
    if (typeof window === 'undefined') return;

    // Log mounting
    if (process.env.NODE_ENV === 'development') {
      // console.debug(`[SkeletonMonitor] Mounted: ${name}`);
    }

    const timer = setInterval(() => {
      setElapsed(Math.round(performance.now() - startTime.current));
    }, 100);

    return () => {
      clearInterval(timer);
      const duration = performance.now() - startTime.current;

      // Se durou menos de 50ms, ignoramos (provavelmente renderização síncrona/cache)
      if (duration < 50) return;

      if (duration > thresholdMs) {
        logger.warn(
          `[Performance] Skeleton "${name}" visible for ${(duration / 1000).toFixed(2)}s`,
          {
            skeleton: name,
            duration_ms: Math.round(duration),
            threshold_ms: thresholdMs,
            path: window.location.pathname,
            timestamp: new Date().toISOString(),
          },
        );
      } else {
        logger.debug(
          `[Performance] Skeleton "${name}" resolved in ${(duration / 1000).toFixed(2)}s (threshold: ${thresholdMs}ms)`,
        );
      }
    };
  }, [name, thresholdMs]);

  // Check for "forced loading" global debug flag
  const [isForced, setIsForced] = useState(false);
  useEffect(() => {
    const checkForced = () => {
      setIsForced((window as any).__FORCE_SKELETONS__ === true);
    };
    checkForced();
    const interval = setInterval(checkForced, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div 
      className="relative h-full min-h-[100px] w-full"
      data-skeleton-monitor={name}
      data-skeleton-elapsed={elapsed}
      data-skeleton-forced={isForced}
    >
      {children}

      {/* Dev-only overlay timer */}
      {isDev && (elapsed > 300 || isForced) && (
        <div className="pointer-events-none fixed bottom-4 right-4 z-[9999]">
          <div
            className={cn(
              'flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[11px] font-bold shadow-lg backdrop-blur-md',
              elapsed > thresholdMs || isForced
                ? 'animate-pulse border-destructive/20 bg-destructive text-destructive-foreground'
                : 'border-border/40 bg-background/80 text-foreground',
            )}
          >
            <div
              className={cn(
                'h-2 w-2 rounded-full',
                elapsed > thresholdMs || isForced ? 'bg-white' : 'animate-pulse bg-primary',
              )}
            />
            {isForced ? '[DEBUG FORCED] ' : ''}Loading {name}: {(elapsed / 1000).toFixed(1)}s
          </div>
        </div>
      )}
    </div>
  );
}
