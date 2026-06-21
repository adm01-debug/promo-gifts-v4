import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReliabilityBadge } from './ReliabilityBadge';
import { ReplenishmentHistoryTable } from './ReplenishmentHistoryTable';
import { UpcomingReplenishments } from './UpcomingReplenishments';
import type {
  MatchingResult,
  SupplierReliability,
} from '@/lib/inventory/supplier-reliability';

interface SupplierDrawerProps {
  supplier: SupplierReliability | null;
  matching: MatchingResult | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function MetricBlock({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-bold tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function fmtPct(v: number | null): string {
  return v === null ? '—' : `${Math.round(v * 100)}%`;
}
function fmtDays(v: number | null): string {
  return v === null ? '—' : `${v.toFixed(1)}d`;
}
function fmtScore(v: number | null): string {
  return v === null ? '—' : `${v}/100`;
}

export function SupplierDrawer({ supplier, matching, open, onOpenChange }: SupplierDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-3xl"
        data-testid="supplier-drawer"
      >
        {supplier && matching && (
          <>
            <SheetHeader className="space-y-2 pb-4">
              <div className="flex flex-wrap items-center gap-3">
                <SheetTitle className="font-display text-2xl">
                  {supplier.supplierName}
                </SheetTitle>
                <ReliabilityBadge band={supplier.band} score={supplier.overall.score} />
              </div>
              <SheetDescription>
                Análise de confiabilidade: previsões de reposição × chegadas reais ao
                estoque.
              </SheetDescription>
            </SheetHeader>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <MetricBlock
                label="Score geral"
                value={fmtScore(supplier.overall.score)}
                hint={`${supplier.matchedCount} chegadas pareadas`}
              />
              <MetricBlock
                label="Score 30d"
                value={fmtScore(supplier.last30d.score)}
                hint={`${supplier.last30d.matchedCount} chegadas`}
              />
              <MetricBlock
                label="Score 90d"
                value={fmtScore(supplier.last90d.score)}
                hint={`${supplier.last90d.matchedCount} chegadas`}
              />
              <MetricBlock
                label="Atraso médio"
                value={fmtDays(supplier.overall.avgDelayDays)}
                hint="apenas atrasos positivos"
              />
              <MetricBlock
                label="Pontualidade"
                value={fmtPct(supplier.overall.pontualityScore)}
                hint="dentro do prazo prometido"
              />
              <MetricBlock
                label="Cumprimento"
                value={fmtPct(supplier.overall.fulfillmentScore)}
                hint="% da quantidade prometida"
              />
              <MetricBlock
                label="Sem previsão"
                value={String(supplier.orphanArrivalsCount)}
                hint="chegadas não anunciadas"
              />
              <MetricBlock
                label="Promessas vencidas"
                value={String(supplier.expiredPromisesCount)}
                hint="sem chegada na janela"
              />
            </div>

            <Tabs defaultValue="history" className="mt-6">
              <TabsList>
                <TabsTrigger value="history" data-testid="drawer-tab-history">
                  Histórico
                </TabsTrigger>
                <TabsTrigger value="upcoming" data-testid="drawer-tab-upcoming">
                  Próximas Reposições
                </TabsTrigger>
              </TabsList>
              <TabsContent value="history" className="mt-4">
                <ReplenishmentHistoryTable supplier={supplier} matching={matching} />
              </TabsContent>
              <TabsContent value="upcoming" className="mt-4">
                <UpcomingReplenishments supplier={supplier} matching={matching} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
