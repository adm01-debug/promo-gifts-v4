import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { PageSEO } from '@/components/seo/PageSEO';
import { StockDashboard } from '@/components/inventory/StockDashboard';

/**
 * StockDashboardPage — entrada de `/estoque`.
 *
 * Cache-busting: ao montar a rota, invalida a query `variant-stock-data`
 * para que o usuário sempre veja números frescos (evita o efeito "preciso
 * dar hard reload pra ver mudança"). React Query continua deduplicando,
 * então o custo é 1 refetch por visita à rota.
 */
export default function StockDashboardPage() {
  const queryClient = useQueryClient();

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['variant-stock-data'] });
    queryClient.invalidateQueries({ queryKey: ['rupture-alerts'] });
  }, [queryClient]);

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
