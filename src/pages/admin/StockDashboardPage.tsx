import { useRef, useState, Suspense } from 'react';
import { PageSEO } from '@/components/seo/PageSEO';
import { StockDashboard } from '@/components/inventory/StockDashboard';
import { StockHeroRiskBanner } from '@/components/inventory/StockHeroRiskBanner';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const RupturePanelEma = lazyWithRetry(() =>
  import('@/components/inventory/risk/RupturePanelEma').then((m) => ({
    default: m.RupturePanelEma,
  })),
);

export default function StockDashboardPage() {
  const [emaActiveLevel, setEmaActiveLevel] = useState<string | null>(null);
  const emaPanelRef = useRef<HTMLDivElement>(null);

  function handleLevelClick(level: string | null) {
    setEmaActiveLevel(level);
    if (level) {
      // Scroll suave ao painel EMA após o re-render
      setTimeout(() => {
        emaPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
    }
  }

  return (
    <>
      <PageSEO
        title="Estoque"
        description="Acompanhe níveis de estoque e disponibilidade dos produtos."
        path="/estoque"
        noIndex
      />
      <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-3 px-3 py-3 pb-24 sm:space-y-4 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8">
        {/* ─── Onda 1 Etapa 2: Hero Risk Banner (aditivo — acima do dashboard) ─── */}
        <StockHeroRiskBanner
          activeLevel={emaActiveLevel}
          onLevelClick={handleLevelClick}
        />

        {/* ─── Dashboard existente (inalterado) ─── */}
        <StockDashboard />

        {/* ─── Onda 1 Etapa 3-5: Painel EMA + sort prioridade + Pedir Reposição ─── */}
        <div ref={emaPanelRef} className="scroll-mt-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">
              Painel de Risco EMA
            </span>
            {emaActiveLevel && (
              <Badge
                variant="secondary"
                className="cursor-pointer gap-1 text-xs"
                onClick={() => setEmaActiveLevel(null)}
                aria-label="Limpar filtro EMA"
              >
                filtro: {emaActiveLevel} ×
              </Badge>
            )}
          </div>
          <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
            <RupturePanelEma focusedLevel={emaActiveLevel} />
          </Suspense>
        </div>
      </div>
    </>
  );
}
