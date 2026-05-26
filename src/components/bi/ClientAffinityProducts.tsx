/**
 * ClientAffinityProducts — Zona 2: "O que esse cliente gosta"
 * Usa dados reais de quote_items quando existem; fallback mock caso contrário.
 */
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Heart, Sparkles, CheckCircle2 } from 'lucide-react';
import { useClientAffinity } from '@/hooks/bi/useClientAffinity';
import { useBICategoryFocus } from '@/contexts/BICategoryFocusContext';
import { resolveBICategory } from '@/lib/bi/categoryResolver';
import { BIProductCard } from './BIProductCard';
import { useMemo } from 'react';

interface Props {
  clientId: string;
}

export function ClientAffinityProducts({ clientId }: Props) {
  const { data, isLoading } = useClientAffinity(clientId);
  const { focusedSlug, focusedLabel } = useBICategoryFocus();

  const visibleCategories = useMemo(() => {
    const cats = data?.categories ?? [];
    if (!focusedSlug) return cats.slice(0, 3);
    const filtered = cats.filter(
      (c) =>
        resolveBICategory(c.suggestions[0]?.name ?? c.category, c.category).slug === focusedSlug,
    );
    return filtered.length > 0 ? filtered : cats.slice(0, 3);
  }, [data, focusedSlug]);

  return (
    <Card className="border-[1.5px]">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Heart className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="font-display font-semibold">Produtos das categorias favoritas</h2>
              <p className="text-xs text-muted-foreground">
                {data?.isMock
                  ? 'Categorias preferidas + sugestões dentro de cada uma'
                  : `Baseado em ${data?.realProductsCount} produtos já orçados · agrupados por categoria`}
              </p>
            </div>
          </div>
          {data &&
            (data.isMock ? (
              <Badge
                variant="outline"
                className="gap-1 border-amber-500/50 text-[10px] text-amber-700 dark:text-amber-300"
              >
                <Sparkles className="h-3 w-3" /> Simulado
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="gap-1 border-emerald-500/50 text-[10px] text-emerald-700 dark:text-emerald-300"
              >
                <CheckCircle2 className="h-3 w-3" /> Dados reais
              </Badge>
            ))}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-44 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-5">
            {visibleCategories.map((cat) => (
              <div key={cat.category}>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-medium">
                    {cat.category}{' '}
                    <span className="text-xs font-normal text-muted-foreground">
                      · {cat.count} compras
                    </span>
                  </h3>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {cat.suggestions.map((s) => (
                    <BIProductCard
                      key={s.name}
                      name={s.name}
                      category={cat.category}
                      priceFrom={s.priceFrom}
                      priceTo={s.priceTo}
                      reason={s.reason}
                      variant="affinity"
                      clientId={clientId}
                      imageUrl={s.imageUrl}
                      productId={s.productId}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
