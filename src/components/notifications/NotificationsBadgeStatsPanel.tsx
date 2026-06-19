import { Activity, Download, ArrowDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotificationsMetricsPanel } from './badge-stats/useNotificationsMetricsPanel';
import { buildSparkPath, downloadJson } from './badge-stats/utils';
import { SuspiciousWarning } from './badge-stats/SuspiciousWarning';
import { EfficiencyGrid } from './badge-stats/EfficiencyGrid';
import { useMemo, useRef } from 'react';
import { notificationsMetrics } from '@/lib/notifications-metrics';

const SPARK_W = 160;
const SPARK_H = 24;

export function NotificationsBadgeStatsPanel() {
  const { isAdmin } = useAuth();
  const isDev = Boolean((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV);
  const visible = isDev || isAdmin;

  const {
    debugOn,
    snapshot,
    samples,
    sparkStats,
    isSuspicious,
    suspiciousStreakSeconds,
    streakWindowStats,
    streakTrend,
    SUSPICIOUS_RATIO_THRESHOLD,
    SPARK_WINDOW_SECONDS,
  } = useNotificationsMetricsPanel(visible);

  const topContributorsRef = useRef<HTMLDivElement | null>(null);

  const handleJumpToContributors = () => {
    topContributorsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const el = topContributorsRef.current;
    if (!el) return;
    el.setAttribute('data-jump-flash', '1');
    window.setTimeout(() => el.removeAttribute('data-jump-flash'), 1500);
  };

  const sparkPoints = useMemo(
    () => buildSparkPath(samples, SPARK_W, SPARK_H, SPARK_WINDOW_SECONDS),
    [samples, SPARK_WINDOW_SECONDS],
  );

  if (!visible) return null;

  const handleExportDebugJson = () => {
    downloadJson('notifications-metrics', {
      exportedAt: new Date().toISOString(),
      debugMode: debugOn,
      sparklineSamples: samples,
      snapshot: notificationsMetrics.snapshot(),
    });
  };

  const handleExportSuspiciousStreakJson = () => {
    if (!isSuspicious) return;
    downloadJson('notifications-suspicious-streak', {
      exportedAt: new Date().toISOString(),
      streakWindowStats,
      trend: streakTrend,
      streakSamples: samples.slice(-suspiciousStreakSeconds),
    });
  };

  return (
    <div className="border-t border-border/40 bg-muted/20 px-3 py-2 text-[11px]">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 font-medium uppercase tracking-wide text-muted-foreground">
          <Activity className="h-3 w-3" aria-hidden="true" />
          Badge stats (QA)
        </span>
        <div className="inline-flex items-center gap-2">
          <SuspiciousWarning
            isSuspicious={isSuspicious}
            suspiciousStreakSeconds={suspiciousStreakSeconds}
            streakWindowStats={streakWindowStats}
            streakTrend={streakTrend as never}
            threshold={SUSPICIOUS_RATIO_THRESHOLD}
          />

          {isSuspicious && (
            <>
              <button
                type="button"
                onClick={handleJumpToContributors}
                className="inline-flex items-center gap-1 rounded border border-warning/40 bg-warning/5 px-1.5 py-0.5 text-[10px] font-medium text-warning transition-colors hover:border-warning/60 hover:bg-warning/15"
              >
                <ArrowDown className="h-2.5 w-2.5" aria-hidden="true" />
                Top contributors
              </button>
              <button
                type="button"
                onClick={handleExportSuspiciousStreakJson}
                className="inline-flex items-center gap-1 rounded border border-warning/40 bg-warning/5 px-1.5 py-0.5 text-[10px] font-medium text-warning transition-colors hover:border-warning/60 hover:bg-warning/15"
              >
                <Download className="h-2.5 w-2.5" aria-hidden="true" />
                Streak JSON
              </button>
            </>
          )}

          <span className="tabular-nums text-muted-foreground">
            T{snapshot.triggers} · F{snapshot.fetches} · {snapshot.ratio.toFixed(2)}
          </span>
          <button
            type="button"
            onClick={handleExportDebugJson}
            className="inline-flex items-center gap-1 rounded border border-border/50 bg-background/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:border-border hover:bg-background hover:text-foreground"
          >
            <Download className="h-2.5 w-2.5" aria-hidden="true" />
            Export JSON
          </button>
        </div>
      </div>

      {debugOn && (
        <>
          <EfficiencyGrid
            triggers={snapshot.triggers}
            fetches={snapshot.fetches}
            ratio={snapshot.ratio}
            byTrigger={snapshot.byTrigger}
            byFetch={snapshot.byFetch}
            fetchesByTtlWindow={snapshot.fetchesByTtlWindow}
            coalescingByTrigger={snapshot.coalescingByTrigger}
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="font-medium text-muted-foreground">
              Sparkline ({SPARK_WINDOW_SECONDS}s)
            </span>
            <span className="tabular-nums text-muted-foreground">
              Latest: {sparkStats.latest.toFixed(2)} · Peak: {sparkStats.peak.toFixed(2)} · Avg:{' '}
              {sparkStats.avg.toFixed(2)}
            </span>
          </div>
          <svg width={SPARK_W} height={SPARK_H} className="h-6 w-full">
            <path
              d={sparkPoints}
              fill="none"
              stroke={isSuspicious ? 'hsl(var(--warning))' : 'hsl(var(--success))'}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          <div className="mt-2 space-y-1">
            <h4 className="font-medium text-muted-foreground">
              Top Contributors (Last {SPARK_WINDOW_SECONDS}s)
            </h4>
            <div
              ref={topContributorsRef}
              className="max-h-24 space-y-0.5 overflow-y-auto rounded border border-border/50 bg-background/50 p-1 text-[10px]"
            >
              {Object.entries(
                (
                  snapshot as unknown as {
                    topContributors?: Record<string, { triggers: number; fetches: number }>;
                  }
                ).topContributors ?? {},
              )
                .sort(([, a], [, b]) => b.fetches - a.fetches)
                .map(([key, contrib]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded px-1 py-0.5 hover:bg-muted/50"
                  >
                    <span className="truncate text-foreground">{key}</span>
                    <span className="tabular-nums text-muted-foreground">
                      T{contrib.triggers} · F{contrib.fetches}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
