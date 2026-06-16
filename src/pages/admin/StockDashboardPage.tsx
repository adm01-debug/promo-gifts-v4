import { PageSEO } from '@/components/seo/PageSEO';
import { StockDashboard } from '@/components/inventory/StockDashboard';

const DESCRIPTION = 'Acompanhe níveis de estoque e disponibilidade dos produtos em tempo real.';

export default function StockDashboardPage() {
  return (
    <>
      <PageSEO
        title="Estoque"
        description="Acompanhe níveis de estoque e disponibilidade dos produtos."
        path="/estoque"
        noIndex
      />
      <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-3 px-3 py-3 pb-24 sm:space-y-4 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8">
        <div className="flex flex-col gap-1">
          <h1
            data-testid="page-title-estoque"
            className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
          >
            Estoque
          </h1>
          <p
            data-testid="page-description-estoque"
            title={DESCRIPTION}
            aria-label={DESCRIPTION}
            className="text-sm leading-5 max-h-5 text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis"
          >
            {DESCRIPTION}
          </p>
        </div>
        <StockDashboard />
      </div>
    </>
  );
}
