import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowDown, ArrowUp, GitCompare, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useResolveProductsSelectComparison,
  getInitialCutover,
  persistCutover,
  type ComparisonWindow,
  type ResolveProductsSelectMetrics,
} from '@/pages/admin/telemetry/useResolveProductsSelectComparison';

type DeltaDirection = 'down-good' | 'neutral' | 'up-bad';

function formatMs(ms: number): string {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatPct(p: number): string {
  if (!Number.isFinite(p) || p === 0) return '0%';
  const sign = p > 0 ? '+' : '';
  return `${sign}${(p * 100).toFixed(1)}%`;
}

function deltaTone(p: number, direction: DeltaDirection) {
  if (Math.abs(p) < 0.05) return { label: 'estável', icon: Minus, tone: 'muted' as const };
  const improved = direction === 'down-good' ? p < 0 : p > 0;
  return improved
    ? { label: 'melhorou', icon: ArrowDown, tone: 'success' as const }
    : { label: 'piorou', icon: ArrowUp, tone: 'destructive' as const };
}

function MetricRow({
  label,
  beforeText,
  afterText,
  delta,
  direction,
}: {
  label: string;
  beforeText: string;
  afterText: string;
  delta: number;
  direction: DeltaDirection;
}) {
  const t = deltaTone(delta, direction);
  const Icon = t.icon;
  return (
    <div className="grid grid-cols-12 items-center gap-2 border-b border-border/40 py-2 last:border-b-0">
      <div className="col-span-4 text-xs text-muted-foreground">{label}</div>
      <div className="col-span-3 text-right font-mono text-sm tabular-nums">{beforeText}</div>
      <div className="col-span-3 text-right font-mono text-sm font-medium tabular-nums">
        {afterText}
      </div>
      <div className="col-span-2 flex items-center justify-end gap-1">
        <Icon
          className={cn(
            'h-3 w-3',
            t.tone === 'success' && 'text-success',
            t.tone === 'destructive' && 'text-destructive',
            t.tone === 'muted' && 'text-muted-foreground',
          )}
        />
        <span
          className={cn(
            'font-mono text-xs tabular-nums',
            t.tone === 'success' && 'text-success',
            t.tone === 'destructive' && 'text-destructive',
            t.tone === 'muted' && 'text-muted-foreground',
          )}
        >
          {formatPct(delta)}
        </span>
      </div>
    </div>
  );
}

function SamplesBadge({ m }: { m: ResolveProductsSelectMetrics }) {
  if (m.samples === 0) {
    return (
      <Badge variant="outline" className="text-[10px]">
        sem amostras
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="font-mono text-[10px]">
      {m.samples} amostras · {m.errors} erros
    </Badge>
  );
}

export function ResolveProductsSelectComparisonCard() {
  const [cutover, setCutover] = useState<string>(getInitialCutover());
  const [windowSize, setWindowSize] = useState<ComparisonWindow>('7d');
  const { comparison, isLoading } = useResolveProductsSelectComparison(cutover, windowSize);

  // datetime-local quer "YYYY-MM-DDTHH:mm" sem segundos/timezone.
  const datetimeLocalValue = cutover.slice(0, 16);

  const handleCutoverChange = (raw: string) => {
    if (!raw) return;
    const iso = new Date(raw).toISOString();
    setCutover(iso);
    persistCutover(iso);
  };

  const insufficient =
    !isLoading && comparison && (comparison.before.samples < 5 || comparison.after.samples < 5);

  return (
    <Card className="border-[1.5px]">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <GitCompare className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">
              Impacto do <span className="font-mono">resolveProductsSelect</span> — listings com
              limit&nbsp;&gt;&nbsp;50
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="datetime-local"
              value={datetimeLocalValue}
              onChange={(e) => handleCutoverChange(e.target.value)}
              className="h-8 w-[200px] text-xs"
              aria-label="Data de corte (deploy do resolveProductsSelect)"
            />
            <Select value={windowSize} onValueChange={(v) => setWindowSize(v as ComparisonWindow)}>
              <SelectTrigger className="h-8 w-24 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">±24h</SelectItem>
                <SelectItem value="7d">±7d</SelectItem>
                <SelectItem value="30d">±30d</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Compara <strong>antes</strong> vs <strong>depois</strong> do corte (pega ±{windowSize} ao
          redor). Apenas <code className="text-[10px]">operation=select</code> em{' '}
          <code className="text-[10px]">products</code>.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading || !comparison ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : (
          <>
            <div className="mb-1 grid grid-cols-12 items-center gap-2 border-b border-border/60 pb-2">
              <div className="col-span-4 text-[10px] uppercase tracking-wide text-muted-foreground">
                Métrica
              </div>
              <div className="col-span-3 text-right text-[10px] uppercase tracking-wide text-muted-foreground">
                Antes
                <div className="mt-1">
                  <SamplesBadge m={comparison.before} />
                </div>
              </div>
              <div className="col-span-3 text-right text-[10px] uppercase tracking-wide text-muted-foreground">
                Depois
                <div className="mt-1">
                  <SamplesBadge m={comparison.after} />
                </div>
              </div>
              <div className="col-span-2 text-right text-[10px] uppercase tracking-wide text-muted-foreground">
                Δ
              </div>
            </div>

            <MetricRow
              label="Latência média"
              beforeText={formatMs(comparison.before.avgMs)}
              afterText={formatMs(comparison.after.avgMs)}
              delta={comparison.deltaPct.avgMs}
              direction="down-good"
            />
            <MetricRow
              label="Latência p50"
              beforeText={formatMs(comparison.before.p50Ms)}
              afterText={formatMs(comparison.after.p50Ms)}
              delta={
                comparison.before.p50Ms > 0
                  ? (comparison.after.p50Ms - comparison.before.p50Ms) / comparison.before.p50Ms
                  : 0
              }
              direction="down-good"
            />
            <MetricRow
              label="Latência p95"
              beforeText={formatMs(comparison.before.p95Ms)}
              afterText={formatMs(comparison.after.p95Ms)}
              delta={comparison.deltaPct.p95Ms}
              direction="down-good"
            />
            <MetricRow
              label="Latência p99"
              beforeText={formatMs(comparison.before.p99Ms)}
              afterText={formatMs(comparison.after.p99Ms)}
              delta={comparison.deltaPct.p99Ms}
              direction="down-good"
            />
            <MetricRow
              label="CPU estimado (µs / registro)"
              beforeText={
                comparison.before.cpuPerRecordUs ? `${comparison.before.cpuPerRecordUs}µs` : '—'
              }
              afterText={
                comparison.after.cpuPerRecordUs ? `${comparison.after.cpuPerRecordUs}µs` : '—'
              }
              delta={comparison.deltaPct.cpuPerRecordUs}
              direction="down-good"
            />
            <MetricRow
              label="Taxa de erro"
              beforeText={`${(comparison.before.errorRate * 100).toFixed(2)}%`}
              afterText={`${(comparison.after.errorRate * 100).toFixed(2)}%`}
              delta={comparison.deltaPct.errorRate}
              direction="down-good"
            />
            <MetricRow
              label="Volume médio (records)"
              beforeText={comparison.before.avgRecords ? String(comparison.before.avgRecords) : '—'}
              afterText={comparison.after.avgRecords ? String(comparison.after.avgRecords) : '—'}
              delta={
                comparison.before.avgRecords > 0
                  ? (comparison.after.avgRecords - comparison.before.avgRecords) /
                    comparison.before.avgRecords
                  : 0
              }
              direction="neutral"
            />

            {insufficient && (
              <div className="mt-3 rounded-md border border-warning/30 bg-warning/10 p-2">
                <p className="text-xs text-warning">
                  ⚠️ Janela com poucas amostras (mínimo recomendado: 5 antes e 5 depois). Aumente a
                  janela ou aguarde mais tráfego para conclusões confiáveis.
                </p>
              </div>
            )}

            <div className="mt-3 flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => handleCutoverChange(new Date(Date.now() - 86_400_000).toISOString())}
              >
                Resetar p/ 24h atrás
              </Button>
              <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                cutover: {new Date(comparison.cutoverIso).toLocaleString('pt-BR')}
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
