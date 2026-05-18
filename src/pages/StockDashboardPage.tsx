import { PageSEO } from "@/components/seo/PageSEO";
import { StockDashboard } from "@/components/inventory/StockDashboard";

export default function StockDashboardPage() {
  return (
      <>
        <PageSEO title="Estoque" description="Acompanhe níveis de estoque e disponibilidade dos produtos." path="/estoque" noIndex />
        <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-3 sm:py-4 space-y-3 sm:space-y-4 pb-24 md:pb-6 animate-fade-in">
          <StockDashboard />
        </div>
      </>
  );
}
