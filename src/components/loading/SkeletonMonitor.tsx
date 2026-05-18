import { useEffect, useRef, useState } from "react";
import { logger } from "@/lib/logger";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { getSkeletonThreshold } from "@/config/skeleton.config";

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
  thresholdMs: manualThresholdMs 
}: SkeletonMonitorProps) {
  const thresholdMs = manualThresholdMs || getSkeletonThreshold(name);
  const startTime = useRef<number>(performance.now());
  const [elapsed, setElapsed] = useState(0);
  const { userRole } = useAuth();
  const isDev = userRole === 'admin' || userRole === 'dev';

  useEffect(() => {
    // Only track if we are in the browser
    if (typeof window === 'undefined') return;

    const timer = setInterval(() => {
      setElapsed(Math.round(performance.now() - startTime.current));
    }, 100);

    return () => {
      clearInterval(timer);
      const duration = performance.now() - startTime.current;
      
      // Se durou menos de 50ms, ignoramos (provavelmente renderização síncrona/cache)
      if (duration < 50) return;

      if (duration > thresholdMs) {
        logger.warn(`[Performance] Skeleton "${name}" visible for ${(duration / 1000).toFixed(2)}s`, {
          skeleton: name,
          duration_ms: Math.round(duration),
          threshold_ms: thresholdMs,
          path: window.location.pathname,
          timestamp: new Date().toISOString()
        });
      } else {
        logger.debug(`[Performance] Skeleton "${name}" resolved in ${(duration / 1000).toFixed(2)}s (threshold: ${thresholdMs}ms)`);
      }
    };
  }, [name, thresholdMs]);

  return (
    <div className="relative w-full h-full min-h-[200px]">
      {children}
      
      {/* Dev-only overlay timer */}
      {isDev && elapsed > 300 && (
        <div className="fixed bottom-4 right-4 z-[9999] pointer-events-none">
          <div className={cn(
            "px-3 py-1.5 rounded-full text-[11px] font-mono font-bold shadow-lg backdrop-blur-md border flex items-center gap-2",
            elapsed > thresholdMs 
              ? "bg-destructive text-destructive-foreground border-destructive/20 animate-pulse" 
              : "bg-background/80 text-foreground border-border/40"
          )}>
            <div className={cn(
              "w-2 h-2 rounded-full",
              elapsed > thresholdMs ? "bg-white" : "bg-primary animate-pulse"
            )} />
            Loading {name}: {(elapsed / 1000).toFixed(1)}s
          </div>
        </div>
      )}
    </div>
  );
}

