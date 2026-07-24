import { useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { PageSEO } from '@/components/seo/PageSEO';
import { ReplenishmentStatsCards } from '@/components/replenishments/ReplenishmentStatsCards';
import { ReplenishmentProductGrid } from '@/components/replenishments/ReplenishmentProductGrid';
import { RecentReplenishmentsWidget } from '@/components/replenishments/RecentReplenishmentsWidget';
import { EnhancedErrorBoundary } from '@/components/errors/EnhancedErrorBoundary';

export default function ReplenishmentsPage() {
  const stickyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = stickyRef.current;
    if (!el) return;
    const update = () => {
      const h = el.getBoundingClientRect().height;
      document.documentElement.style.setProperty('--replenishment-sticky-h', `${Math.round(h)}px`);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
      document.documentElement.style.removeProperty('--replenishment-sticky-h');
    };
  }, []);

  return (
    <>
      <PageSEO
        title="Reposição — Produtos Repostos"
        description="Acompanhe os produtos repostos pelos fornecedores nos últimos 30 dias. Visualize KPIs, filtre por categoria e fornecedor."
        path="/reposicao"
      />
      <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-4 px-4 py-4 pb-24 lg:px-6 xl:px-8">
        {/* Cabeçalho — mesmo padrão de Novidades (compacto, 1 linha) */}
        <div
          ref={stickyRef}
          className="sticky top-[calc(var(--header-h,56px)+var(--breadcrumb-h,0px))] z-30 -mx-4 space-y-3 border-b border-border/40 bg-background/95 px-4 pb-3 pt-2 backdrop-blur-md lg:-mx-6 lg:px-6 xl:-mx-8 xl:px-8"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm sm:h-10 sm:w-10">
              <RefreshCw className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="flex min-w-0 flex-1 items-baseline gap-2 truncate">
              <h1
                data-testid="page-title-reposicao"
                className="shrink-0 font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl"
              >
                Reposição
              </h1>
              <p
                data-testid="replenishment-description"
                className="min-w-0 truncate text-xs font-medium text-muted-foreground sm:text-sm"
              >
                Produtos que voltaram ao estoque dos fornecedores nos últimos 30 dias
              </p>
            </div>
          </div>

          <ReplenishmentStatsCards />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-[1fr_280px]">
          <main className="order-2 min-w-0 xl:order-1">
            <EnhancedErrorBoundary>
              <ReplenishmentProductGrid />
            </EnhancedErrorBoundary>
          </main>
          <aside className="order-1 xl:sticky xl:top-4 xl:order-2 xl:self-start">
            <EnhancedErrorBoundary>
              <RecentReplenishmentsWidget />
            </EnhancedErrorBoundary>
          </aside>
        </div>
      </div>
    </>
  );
}
