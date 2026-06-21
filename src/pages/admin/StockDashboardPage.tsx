import { PageSEO } from '@/components/seo/PageSEO';
import { StockDashboard } from '@/components/inventory/StockDashboard';

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
        <StockDashboard />
      </div>
    </>
  );
}
