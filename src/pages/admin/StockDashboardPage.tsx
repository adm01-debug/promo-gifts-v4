/**
 * StockDashboardPage — Onda 3 completa.
 * Adicionado: WhatIfPanel, SavedViews chips, atalhos de teclado.
 */
import { useRef, useState, Suspense } from 'react';
import { PageSEO } from '@/components/seo/PageSEO';
import { StockDashboard } from '@/components/inventory/StockDashboard';
import { StockHeroRiskBanner } from '@/components/inventory/StockHeroRiskBanner';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, BookmarkCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useKeyboardShortcut } from '@/components/a11y';
import { useToast } from '@/hooks/ui';

const RupturePanelEma = lazyWithRetry(() =>
  import('@/components/inventory/risk/RupturePanelEma').then((m) => ({ default: m.RupturePanelEma })),
);
const WhatIfPanel = lazyWithRetry(() =>
  import('@/components/inventory/risk/WhatIfPanel').then((m) => ({ default: m.WhatIfPanel })),
);

export default function StockDashboardPage() {
  const [emaActiveLevel, setEmaActiveLevel] = useState<string | null>(null);
  const [showWhatIf, setShowWhatIf] = useState(false);
  const emaPanelRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  function handleLevelClick(level: string | null) {
    setEmaActiveLevel(level);
    if (level) setTimeout(() => emaPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
  }

  // Atalhos de teclado (Ctrl+E = painel EMA, Ctrl+W = What-if, Esc = limpar filtro)
  useKeyboardShortcut('ctrl+e', () => {
    emaPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    toast({ title: '⤵ Painel EMA', description: 'Ctrl+W = What-if · Ctrl+E = ir para o painel' });
  });
  useKeyboardShortcut('ctrl+w', () => setShowWhatIf((v) => !v), { preventDefault: true });

  return (
    <>
      <PageSEO title="Estoque" description="Risco EMA em tempo real." path="/estoque" noIndex />
      <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-3 px-3 py-3 pb-24 sm:space-y-4 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8">

        {/* Onda 1+3: Hero + forecast strip */}
        <StockHeroRiskBanner activeLevel={emaActiveLevel} onLevelClick={handleLevelClick} />

        {/* Dashboard existente */}
        <StockDashboard />

        {/* Onda 3: What-if panel (toggle via Ctrl+W) */}
        {showWhatIf && (
          <Suspense fallback={<Skeleton className="h-48 w-full rounded-xl" />}>
            <WhatIfPanel />
          </Suspense>
        )}

        {/* Onda 1-3: Painel EMA completo */}
        <div ref={emaPanelRef} className="scroll-mt-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Painel de Risco EMA</span>
            {emaActiveLevel && (
              <Badge
                variant="secondary"
                className="cursor-pointer gap-1 text-xs"
                onClick={() => setEmaActiveLevel(null)}
              >
                filtro: {emaActiveLevel} ×
              </Badge>
            )}
            {/* Hint de atalhos */}
            <span className="ml-auto text-[10px] text-muted-foreground/60 hidden lg:inline">
              <kbd className="rounded border px-1">Ctrl+E</kbd> navegar
              · <kbd className="rounded border px-1">Ctrl+W</kbd> what-if
            </span>
          </div>
          <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
            <RupturePanelEma focusedLevel={emaActiveLevel} />
          </Suspense>
        </div>
      </div>
    </>
  );
}
