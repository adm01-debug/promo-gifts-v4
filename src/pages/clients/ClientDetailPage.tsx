import { useParams } from 'react-router-dom';
import { PageSEO } from '@/components/seo/PageSEO';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useClientTopProducts, useCrmCompany } from '@/hooks/crm';
import { ClientDetailHeader } from '@/components/clients/ClientDetailHeader';
import { TrendingUp } from 'lucide-react';
import { getCompanyDisplayName } from '@/types/crm';

export default function ClientDetailPage() {
  const { id } = useParams();
  const { data: client, isLoading: loadingClient } = useCrmCompany(id);
  const { data: topProducts = [], isLoading: loadingProducts } = useClientTopProducts(id);

  if (loadingClient) {
    return (
      <div className="mx-auto w-full max-w-[1920px] space-y-4 px-3 py-3 sm:px-4 sm:py-4 lg:px-6 xl:px-8">
        <Skeleton className="h-20" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="mx-auto w-full max-w-[1920px] px-4 py-8">
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            Cliente não encontrado.
          </CardContent>
        </Card>
      </div>
    );
  }

  const name = getCompanyDisplayName(client);
  const formatBRL = (n: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

  return (
    <>
      <PageSEO
        title={`${name} | Clientes`}
        description={`Detalhes de ${name}: produtos mais comprados.`}
        path={`/clientes/${id}`}
      />
      <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-3 px-3 py-3 pb-24 sm:space-y-4 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8">
        <ClientDetailHeader client={client} />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-primary" /> Produtos mais comprados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loadingProducts ? (
              <Skeleton className="h-16" />
            ) : topProducts.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Sem dados de produtos ainda.
              </p>
            ) : (
              topProducts.map((p) => (
                <div
                  key={(p.sku ?? '') + p.name}
                  className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-muted/50"
                >
                  <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded bg-muted">
                    {p.image && (
                      <img
                        src={p.image}
                        alt={p.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.totalQuantity} un · {p.orderCount}{' '}
                      {p.orderCount === 1 ? 'pedido' : 'pedidos'}
                    </p>
                  </div>
                  <p className="flex-shrink-0 text-xs font-medium text-foreground">
                    {formatBRL(p.totalValue)}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
