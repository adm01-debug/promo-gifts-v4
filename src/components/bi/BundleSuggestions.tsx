/**
 * BundleSuggestions — "Combos para a categoria favorita"
 *
 * Reposicionado para gravitar em torno de CATEGORIA:
 *  1. Resolve a categoria favorita do cliente via useClientCategoryAffinity
 *  2. Permite ao vendedor trocar de categoria via dropdown (top 5 categorias)
 *  3. Ancora o RPC get_bundle_suggestions no top produto da categoria escolhida
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Package2, ShoppingBasket, TrendingUp, Layers } from 'lucide-react';
import { useClientCategoryAffinity } from '@/hooks/bi/useClientCategoryAffinity';
import { useBICategoryFocus } from '@/contexts/BICategoryFocusContext';

interface Props {
  clientId: string;
}

interface BundleRow {
  product_id: string;
  product_name: string;
  product_image_url: string | null;
  cooccurrence_count: number;
  frequency_percent: number;
}

export function BundleSuggestions({ clientId }: Props) {
  const affinity = useClientCategoryAffinity(clientId);
  const { focusedSlug } = useBICategoryFocus();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  // Categorias com pelo menos 1 produto real conhecido (para servir de âncora)
  const selectableCategories = useMemo(
    () => affinity.categories.filter((c) => c.topProducts.length > 0).slice(0, 6),
    [affinity.categories],
  );

  const activeCategory = useMemo(() => {
    // Foco global ganha prioridade sobre seleção local
    if (focusedSlug) {
      return (
        selectableCategories.find((c) => c.slug === focusedSlug) ?? selectableCategories[0] ?? null
      );
    }
    if (selectedSlug) {
      return (
        selectableCategories.find((c) => c.slug === selectedSlug) ?? selectableCategories[0] ?? null
      );
    }
    return selectableCategories[0] ?? null;
  }, [selectedSlug, selectableCategories, focusedSlug]);

  const anchorProduct = activeCategory?.topProducts[0] ?? null;
  const anchorId = anchorProduct?.productId ?? null;
  const anchorName = anchorProduct?.productName ?? null;

  const { data, isLoading } = useQuery({
    queryKey: ['bi-bundle-suggestions', anchorId],
    enabled: !!anchorId,
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<BundleRow[]> => {
      if (!anchorId) return [];
      const { data: queryRows, error } = await supabase.rpc('get_bundle_suggestions', {
        _product_id: anchorId,
      });
      if (error || !Array.isArray(queryRows)) return [];
      return queryRows as BundleRow[];
    },
  });

  if (selectableCategories.length === 0) return null;

  const headerSelector = selectableCategories.length > 1 && (
    <Select
      value={activeCategory?.slug ?? selectableCategories[0]?.slug}
      onValueChange={(v) => setSelectedSlug(v)}
    >
      <SelectTrigger className="h-8 w-[200px] text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {selectableCategories.map((c) => (
          <SelectItem key={c.slug} value={c.slug} className="text-xs">
            <span className="flex items-center gap-2">
              <Layers className="h-3 w-3 text-muted-foreground" />
              {c.label}
              <span className="text-[10px] tabular-nums text-muted-foreground">
                ({Math.round(c.revenueSharePct)}%)
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <Card className="border-[1.5px]">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
              <ShoppingBasket className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-sm font-semibold sm:text-base">
                Combos para a categoria{' '}
                <span className="text-emerald-700 dark:text-emerald-300">
                  {activeCategory?.label ?? 'favorita'}
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                {anchorName
                  ? `Cruzando com ${anchorName} — produto âncora dessa categoria.`
                  : 'Sugestões baseadas em pedidos reais de outros clientes.'}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {headerSelector}
            <Badge
              variant="outline"
              className="gap-1 border-emerald-500/40 text-[10px] text-emerald-700 dark:text-emerald-300"
            >
              <TrendingUp className="h-3 w-3" /> Cross-sell
            </Badge>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          <p className="py-6 text-center text-xs italic text-muted-foreground">
            Sem combos identificados para essa categoria ainda. Tente outra categoria favorita.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            {data.map((b) => (
              <div
                key={b.product_id}
                className="rounded-lg border bg-card p-3 transition-all hover:border-primary/30 hover:shadow-sm"
              >
                {b.product_image_url ? (
                  <div className="mb-2 aspect-square overflow-hidden rounded-md border bg-muted/40">
                    <img
                      src={b.product_image_url}
                      alt={b.product_name}
                      loading="lazy"
                      className="h-full w-full object-contain"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                ) : (
                  <div className="mb-2 flex aspect-square items-center justify-center rounded-md bg-muted/40">
                    <Package2 className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="line-clamp-2 min-h-[2rem] text-xs font-medium leading-snug">
                  {b.product_name}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{b.cooccurrence_count}× junto</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {Math.round(b.frequency_percent)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
