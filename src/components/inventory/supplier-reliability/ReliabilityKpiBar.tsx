import { ShieldCheck, ShieldAlert, ShieldX, Shield } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { SupplierReliability } from '@/lib/inventory/supplier-reliability';

interface ReliabilityKpiBarProps {
  suppliers: readonly SupplierReliability[];
}

export function ReliabilityKpiBar({ suppliers }: ReliabilityKpiBarProps) {
  const counts = { high: 0, medium: 0, low: 0, unknown: 0 };
  let totalMatches = 0;
  let totalOrphans = 0;
  let totalExpired = 0;
  for (const s of suppliers) {
    counts[s.band] += 1;
    totalMatches += s.matchedCount;
    totalOrphans += s.orphanArrivalsCount;
    totalExpired += s.expiredPromisesCount;
  }
  const items = [
    {
      key: 'high',
      label: 'Confiança Alta',
      value: counts.high,
      hint: 'Score ≥ 85 — promessas geralmente cumpridas no prazo e na quantidade.',
      icon: <ShieldCheck className="h-5 w-5 text-emerald-600" />,
      ring: 'ring-emerald-500/20',
    },
    {
      key: 'medium',
      label: 'Confiança Média',
      value: counts.medium,
      hint: 'Score 60–84 — atrasos ocasionais ou cumprimento parcial.',
      icon: <Shield className="h-5 w-5 text-amber-600" />,
      ring: 'ring-amber-500/20',
    },
    {
      key: 'low',
      label: 'Confiança Baixa',
      value: counts.low,
      hint: 'Score < 60 — atrasos frequentes ou entregas muito incompletas.',
      icon: <ShieldX className="h-5 w-5 text-rose-600" />,
      ring: 'ring-rose-500/20',
    },
    {
      key: 'unknown',
      label: 'Sem Histórico',
      value: counts.unknown,
      hint: 'Ainda não houve chegadas pareadas no período analisado.',
      icon: <ShieldAlert className="h-5 w-5 text-muted-foreground" />,
      ring: 'ring-border',
    },
  ] as const;

  return (
    <div
      className="grid grid-cols-2 gap-3 md:grid-cols-4"
      data-testid="reliability-kpi-bar"
    >
      {items.map((item) => (
        <Card key={item.key} className={`ring-1 ${item.ring}`}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-card-foreground/5">
              {item.icon}
            </div>
            <div className="min-w-0">
              <div className="text-2xl font-bold tabular-nums leading-none">{item.value}</div>
              <div className="mt-1 text-xs font-medium text-muted-foreground">{item.label}</div>
            </div>
          </CardContent>
        </Card>
      ))}
      <div className="col-span-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground md:col-span-4">
        <span>
          <strong className="text-foreground tabular-nums">{totalMatches}</strong> chegadas pareadas
        </span>
        <span>·</span>
        <span>
          <strong className="text-foreground tabular-nums">{totalOrphans}</strong> chegadas sem
          previsão
        </span>
        <span>·</span>
        <span>
          <strong className="text-foreground tabular-nums">{totalExpired}</strong> promessas
          vencidas sem chegada
        </span>
      </div>
    </div>
  );
}
