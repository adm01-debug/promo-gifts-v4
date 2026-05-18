import { useParams } from "react-router-dom";
import { PageSEO } from "@/components/seo/PageSEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCrmCompany } from "@/hooks/useCrmCompanies";
import { useClientTopProducts } from "@/hooks/useClientTopProducts";
import { ClientDetailHeader } from "@/components/clients/ClientDetailHeader";
import { TrendingUp } from "lucide-react";
import { getCompanyDisplayName } from "@/types/crm";

export default function ClientDetailPage() {
  const { id } = useParams();
  const { data: client, isLoading: loadingClient } = useCrmCompany(id);
  const { data: topProducts = [], isLoading: loadingProducts } = useClientTopProducts(id);

  if (loadingClient) {
    return (
        <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-3 sm:py-4 space-y-4">
          <Skeleton className="h-20" />
          <Skeleton className="h-24" />
        </div>
    );
  }

  if (!client) {
    return (
        <div className="w-full max-w-[1920px] mx-auto px-4 py-8">
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
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

  return (
      <>
        <PageSEO
          title={`${name} | Clientes`}
          description={`Detalhes de ${name}: produtos mais comprados.`}
          path={`/clientes/${id}`}
        />
        <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-3 sm:py-4 space-y-3 sm:space-y-4 pb-24 md:pb-6 animate-fade-in">
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
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Sem dados de produtos ainda.
                </p>
              ) : (
                topProducts.map((p) => (
                  <div key={(p.sku ?? "") + p.name} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors">
                    <div className="h-10 w-10 rounded bg-muted overflow-hidden flex-shrink-0">
                      {p.image && <img src={p.image} alt={p.name} className="h-full w-full object-cover" loading="lazy" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.totalQuantity} un · {p.orderCount} {p.orderCount === 1 ? "pedido" : "pedidos"}
                      </p>
                    </div>
                    <p className="text-xs font-medium text-foreground flex-shrink-0">{formatBRL(p.totalValue)}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </>
  );
}
