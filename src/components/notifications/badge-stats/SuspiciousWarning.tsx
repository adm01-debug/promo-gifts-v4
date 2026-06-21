import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

// Re-using common components from the main project
import {
  Tooltip as ShadcnTooltip,
  TooltipContent as ShadcnTooltipContent,
  TooltipProvider as ShadcnTooltipProvider,
  TooltipTrigger as ShadcnTooltipTrigger,
} from '@/components/ui/tooltip';

interface SuspiciousWarningProps {
  isSuspicious: boolean;
  suspiciousStreakSeconds: number;
  streakWindowStats: {
    triggers: number;
    fetches: number;
    ratio: number;
    fromT: number;
    toT: number;
  };
  streakTrend: {
    direction: 'falling' | 'flat' | 'rising';
    slopePerSec: number;
    suggestion: { primary: string; rationale: string } | null;
  };
  threshold: number;
}

export function SuspiciousWarning({
  isSuspicious,
  suspiciousStreakSeconds,
  streakWindowStats,
  streakTrend,
  threshold,
}: SuspiciousWarningProps) {
  if (!isSuspicious) return null;

  return (
    <ShadcnTooltipProvider>
      <ShadcnTooltip>
        <ShadcnTooltipTrigger asChild>
          <span
            role="status"
            aria-live="polite"
            className="inline-flex animate-pulse cursor-help items-center gap-1 rounded border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-[10px] font-semibold text-warning"
          >
            <AlertTriangle className="h-2.5 w-2.5" aria-hidden="true" />
            ratio ≥ {threshold} for {suspiciousStreakSeconds}s
          </span>
        </ShadcnTooltipTrigger>
        <ShadcnTooltipContent side="bottom" align="end">
          <div className="text-tooltip space-y-1 font-mono leading-snug">
            <div className="flex items-center gap-1 font-semibold text-warning">
              <AlertTriangle className="h-2.5 w-2.5" aria-hidden="true" />
              Suspicious window
            </div>
            <div className="text-muted-foreground">
              ratio ≥ {threshold} for {suspiciousStreakSeconds}s
              {streakWindowStats.fromT > 0 && (
                <span className="block">
                  {new Date(streakWindowStats.fromT).toLocaleTimeString()} →{' '}
                  {new Date(streakWindowStats.toT).toLocaleTimeString()}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-0 border-t border-border/40 pt-1">
              <span className="text-muted-foreground">triggers (window)</span>
              <span className="text-right tabular-nums text-foreground">
                {streakWindowStats.triggers}
              </span>
              <span className="text-muted-foreground">fetches (window)</span>
              <span className="text-right tabular-nums text-foreground">
                {streakWindowStats.fetches}
              </span>
              <span className="text-muted-foreground">saved (window)</span>
              <span className="text-right tabular-nums text-primary">
                {Math.max(0, streakWindowStats.triggers - streakWindowStats.fetches)}
              </span>
            </div>
            <div className="border-t border-border/40 pt-1 text-muted-foreground">
              <span className="block">ratio = fetches / triggers</span>
              <span className="block">
                = {streakWindowStats.fetches} / {streakWindowStats.triggers} ={' '}
                <span className="font-semibold text-warning">
                  {streakWindowStats.ratio.toFixed(3)}
                </span>
              </span>
            </div>
            {streakTrend.suggestion && (
              <div className="border-t border-border/40 pt-1">
                <div className="inline-flex items-center gap-1 text-foreground">
                  <span className="font-semibold">💡 Suggestion</span>
                  <span
                    className={cn(
                      'text-tooltip rounded px-1 font-semibold uppercase tracking-wide',
                      streakTrend.direction === 'rising'
                        ? 'bg-warning/15 text-warning'
                        : streakTrend.direction === 'falling'
                          ? 'bg-primary/15 text-primary'
                          : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {streakTrend.direction}
                    {streakTrend.slopePerSec !== 0 && (
                      <>
                        {' '}
                        {streakTrend.slopePerSec > 0 ? '+' : ''}
                        {streakTrend.slopePerSec.toFixed(2)}/s
                      </>
                    )}
                  </span>
                </div>
                <div className="mt-0.5 text-foreground">→ {streakTrend.suggestion.primary}</div>
                <div className="text-tooltip mt-0.5 text-muted-foreground">
                  {streakTrend.suggestion.rationale}
                </div>
              </div>
            )}
          </div>
        </ShadcnTooltipContent>
      </ShadcnTooltip>
    </ShadcnTooltipProvider>
  );
}
