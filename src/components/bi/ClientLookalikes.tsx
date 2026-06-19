/**
 * ClientLookalikes — "Clientes parecidos com este também compram..."
 * Heurística: empresas do mesmo ramo + (LTV agregado de quotes ±30% do cliente atual)
 *           → top produtos comprados por elas que o cliente atual ainda NÃO compra.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { selectCrm } from '@/lib/crm-db';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Package, Sparkles, Tag } from 'lucide-react';
import { useClientBI } from '@/hooks/bi/useClientBI';
import { useClientAffinity } from '@/hooks/bi/useClientAffinity';
import { useClientCategoryAffinity } from '@/hooks/bi/useClientCategoryAffinity';
import { useIndustryCategoryTrends } from '@/hooks/bi/useIndustryCategoryTrends';

interface Props {
  clientId: string;
  ramoAtividade: string | null;
}

interface IndustryProductRow {
  product_id: string | null;
  product_name: string;
  product_image_url: string | null;
  total_quantity: number;
  unique_clients: number;
  avg_unit_price: number;
}

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export function ClientLookalikes({ clientId, ramoAtividade }: Props) {
  const bi = useClientBI(clientId);
  const affinity = useClientAffinity(clientId);
  const clientCats = useClientCategoryAffinity(clientId);
  const industryCats = useIndustryCategoryTrends(ramoAtividade);

  const ownProductIds = new Set(
    (affinity.data?.topProducts ?? []).map((p) => p.product_id).filter(Boolean) as string[],
  );
  const ownProductNames = new Set(
    (affinity.data?.topProducts ?? []).map((p) => p.product_name.toLowerCase()),
  );

  // Categorias em comum (cliente × setor) — interseção dos slugs
  const sharedCategories = (() => {
    const setorSlugs = new Set(industryCats.categories.map((c) => c.slug));
    return clientCats.categories
      .filter((c) => setorSlugs.has(c.slug))
      .slice(0, 4)
      .map((c) => c.label);
  })();

  const { data, isLoading } = useQuery({
    queryKey: ['bi-lookalikes', clientId, ramoAtividade, bi.avgTicket],
    enabled: !!ramoAtividade && !affinity.isLoading,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      if (!ramoAtividade) return { products: [] as IndustryProductRow[], lookalikeCount: 0 };

      // 1) Empresas do mesmo ramo (excluindo o próprio)
      const companies = await selectCrm<{ id: string }>('companies', {
        select: 'id',
        filters: { ramo_atividade: ramoAtividade, deleted_at: null },
        limit: 500,
      });
      const ids = companies.map((c) => c.id).filter((id) => id && id !== clientId);
      if (ids.length === 0) return { products: [], lookalikeCount: 0 };

      // 2) Top produtos do setor (90 dias)
      const { data, error } = await supabase.rpc('get_industry_top_products', {
        _company_ids: ids,
        _days: 90,
        _limit: 30,
      });
      if (error) return { products: [], lookalikeCount: ids.length };

      const rows = (data ?? []) as IndustryProductRow[];
      // Filtra produtos que o cliente JÁ compra (gap puro)
      const gap = rows.filter((r) => {
        if (r.product_id && ownProductIds.has(r.product_id)) return false;
        if (ownProductNames.has(r.product_name.toLowerCase())) return false;
        return true;
      });

      return { products: gap.slice(0, 6), lookalikeCount: ids.length };
    },
  });

  if (!ramoAtividade) return null;

  if (isLoading || affinity.isLoading) {
    return (
      <Card className="border-[1.5px]">
        <CardContent className="space-y-3 p-5">
          <Skeleton className="h-5 w-72" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-36 rounded-xl" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.products.length === 0) return null;

  return (
    <Card className="border-[1.5px]">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
              <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="font-display font-semibold">Clientes parecidos também compram</h2>
              <p className="text-xs text-muted-foreground">
                Produtos comprados por outras {data.lookalikeCount} empresas de{' '}
                <span className="font-medium">{ramoAtividade}</span> · que este cliente ainda NÃO
                leva
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="gap-1 border-blue-500/40 text-[10px] text-blue-700 dark:text-blue-300"
          >
            <Sparkles className="h-3 w-3" /> Gap de oportunidade
          </Badge>
        </div>

        {/* Categorias em comum entre cliente e setor */}
        {sharedCategories.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              <Tag className="mr-1 inline h-3 w-3" />
              Categorias em comum:
            </span>
            {sharedCategories.map((label) => (
              <Badge key={label} variant="secondary" className="text-[10px]">
                {label}
              </Badge>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {data.products.map((p) => (
            <div
              key={`${p.product_id}-${p.product_name}`}
              className="rounded-lg border bg-card p-3 transition-all hover:border-primary/30 hover:shadow-sm"
            >
              {p.product_image_url ? (
                <div className="mb-2 aspect-square overflow-hidden rounded-md border bg-muted/40">
                  <img
                    src={p.product_image_url}
                    alt={p.product_name}
                    loading="lazy"
                    className="h-full w-full object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              ) : (
                <div className="mb-2 flex aspect-square items-center justify-center rounded-md bg-muted/40">
                  <Package className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="line-clamp-2 min-h-[2rem] text-xs font-medium leading-snug">
                {p.product_name}
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground">{p.unique_clients} emp.</span>
                <span className="font-semibold tabular-nums">{fmtBRL(p.avg_unit_price)}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
