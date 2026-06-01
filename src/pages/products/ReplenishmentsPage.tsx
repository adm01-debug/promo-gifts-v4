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
      <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-4 px-4 py-4 pb-24 lg:px-6 xl:px-8">
        {/* Cabeçalho da página */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm">
              <RefreshCw className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h1
                data-testid="page-title-reposicao"
                className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
              >
                Reposição
              </h1>
              <p
                data-testid="replenishment-description"
                className="mt-1 text-sm font-medium text-muted-foreground sm:text-base"
              >
                Produtos que voltaram ao estoque dos fornecedores nos últimos 30 dias
              </p>
            </div>
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
