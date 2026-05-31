import { RefreshCw } from 'lucide-react';
import { PageSEO } from '@/components/seo/PageSEO';
import { ReplenishmentStatsCards } from '@/components/replenishments/ReplenishmentStatsCards';
import { ReplenishmentProductGrid } from '@/components/replenishments/ReplenishmentProductGrid';
import { RecentReplenishmentsWidget } from '@/components/replenishments/RecentReplenishmentsWidget';

export default function ReplenishmentsPage() {
  return (
    <>
      <PageSEO
        title="Reposição — Produtos Repostos"
        description="Acompanhe os produtos repostos pelos fornecedores nos últimos 30 dias. Visualize KPIs, filtre por categoria e fornecedor."
        path="/reposicao"
      />
      <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-3 px-3 py-3 pb-24 sm:space-y-4 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8">
        {/* Cabeçalho da página */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <RefreshCw className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1
              data-testid="page-title-reposicao"
              className="font-display text-2xl font-bold tracking-tight"
            >
              Reposição
            </h1>
            <p className="text-sm text-muted-foreground">
              Produtos que voltaram ao estoque dos fornecedores nos últimos 30 dias
            </p>
          </div>
        </div>

        <ReplenishmentStatsCards />
        <div className="grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-[1fr_280px]">
          <main className="order-2 min-w-0 xl:order-1">
            <ReplenishmentProductGrid />
          </main>
          <aside className="order-1 xl:sticky xl:top-4 xl:order-2 xl:self-start">
            <RecentReplenishmentsWidget />
          </aside>
        </div>
      </div>
    </>
  );
}
