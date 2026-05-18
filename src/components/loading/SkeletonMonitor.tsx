import { useEffect, useRef, useState } from "react";
import { logger } from "@/lib/logger";
import { useAuth } from "@/contexts/AuthContext";

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
  thresholdMs = 2000 
}: SkeletonMonitorProps) {
  const startTime = useRef<number>(performance.now());
  const [elapsed, setElapsed] = useState(0);
  const { userRole } = useAuth();
  const isDev = userRole === 'admin' || userRole === 'dev';

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(Math.round(performance.now() - startTime.current));
    }, 100);

    return () => {
      clearInterval(timer);
      const duration = performance.now() - startTime.current;
      
      if (duration > thresholdMs) {
        logger.warn(`[Performance] Skeleton "${name}" visible for ${(duration / 1000).toFixed(2)}s`, {
          skeleton: name,
          duration_ms: duration,
          threshold_ms: thresholdMs,
          path: window.location.pathname,
          timestamp: new Date().toISOString()
        });
      } else {
        logger.debug(`[Performance] Skeleton "${name}" resolved in ${(duration / 1000).toFixed(2)}s`);
      }
    };
  }, [name, thresholdMs]);

  return (
    <div className="relative w-full h-full">
      {children}
      
      {/* Dev-only overlay timer */}
      {isDev && elapsed > 500 && (
        <div className="absolute top-2 right-2 z-50 pointer-events-none">
          <div className={cn(
            "px-2 py-1 rounded text-[10px] font-mono font-bold shadow-sm backdrop-blur-md border",
            elapsed > thresholdMs 
              ? "bg-destructive/10 text-destructive border-destructive/20 animate-pulse" 
              : "bg-background/80 text-muted-foreground border-border/40"
          )}>
            {name}: {(elapsed / 1000).toFixed(1)}s
          </div>
        </div>
      )}
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
