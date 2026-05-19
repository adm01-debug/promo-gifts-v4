import { PageSEO } from "@/components/seo/PageSEO";
import { ReplenishmentStatsCards } from "@/components/replenishments/ReplenishmentStatsCards";
import { ReplenishmentProductGrid } from "@/components/replenishments/ReplenishmentProductGrid";
import { RecentReplenishmentsWidget } from "@/components/replenishments/RecentReplenishmentsWidget";

export default function ReplenishmentsPage() {
  return (
    <>
      <PageSEO
        title="Reposição — Produtos Repostos"
        description="Acompanhe os produtos repostos pelos fornecedores nos últimos 30 dias. Visualize KPIs, filtre por categoria e fornecedor."
        path="/reposicao"
      />
      <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-3 sm:py-4 space-y-3 sm:space-y-4 pb-24 md:pb-6 animate-fade-in">
        <header className="flex items-center justify-between gap-3 flex-wrap">
          <h1
            data-testid="page-title-reposicao"
            className="font-display text-xl sm:text-2xl lg:text-3xl font-bold"
          >
            Reposição
          </h1>
        </header>
        <ReplenishmentStatsCards />
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-3 sm:gap-4">
          <main className="order-2 xl:order-1 min-w-0">
            <ReplenishmentProductGrid />
          </main>
          <aside className="order-1 xl:order-2 xl:sticky xl:top-4 xl:self-start">
            <RecentReplenishmentsWidget />
          </aside>
        </div>
      </div>
    </>
  );
}
