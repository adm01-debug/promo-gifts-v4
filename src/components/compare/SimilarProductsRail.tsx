/**
 * SimilarProductsRail — bottom rail "Compare também com..." 4-6 produtos similares.
 * Mesma categoria + faixa de preço ±20% dos produtos já em comparação.
 */
import { useMemo } from 'react';
import { useProducts } from '@/hooks/products';
import { useComparisonStore } from '@/stores/useComparisonStore';
import { Button } from '@/components/ui/button';
import { Plus, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import type { Product } from '@/types/product-catalog';

interface Props {
  products: Product[];
  formatCurrency: (v: number) => string;
}

export function SimilarProductsRail({ products, formatCurrency }: Props) {
  const addToCompare = useComparisonStore((s) => s.addToCompare);
  const isInCompare = useComparisonStore((s) => s.isInCompare);
  const canAddMore = useComparisonStore((s) => s.canAddMore);
  const primaryCategory = products[0]?.category?.name;
  const { data } = useProducts(primaryCategory ? { category: primaryCategory } : undefined, {
    enabled: !!primaryCategory,
    staleTime: 10 * 60 * 1000,
  });
  const pool = useMemo((): Product[] => {
    return Array.isArray(data) ? (data as Product[]) : [];
  }, [data]);

  const suggestions = useMemo(() => {
    if (!pool.length || !products.length) return [];
    const compareIds = new Set(products.map((p) => p.id));
    const avgPrice = products.reduce((sum, p) => sum + Number(p.price ?? 0), 0) / products.length;
    const minP = avgPrice * 0.8;
    const maxP = avgPrice * 1.2;
    return pool
      .filter((p) => !compareIds.has(p.id) && p.price >= minP && p.price <= maxP)
      .slice(0, 6);
  }, [pool, products]);

  if (suggestions.length === 0) return null;

  const handleAdd = (id: string, name: string) => {
    if (!canAddMore) {
      toast.error('Máximo 4 produtos');
      return;
    }
    if (addToCompare(id)) toast.success(`${name} adicionado à comparação`);
  };

  return (
    <section className="space-y-3" aria-label="Produtos similares para comparar">
      <header className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="font-display text-base font-semibold">Compare também com…</h2>
      </header>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {suggestions.map((p) => (
          <div
            key={p.id}
            className="space-y-2 rounded-xl border border-border bg-card p-3 transition-all hover:border-primary/40 hover:shadow-md"
          >
            <div className="aspect-square overflow-hidden rounded-lg bg-muted">
              <img
                src={p.images?.[0]}
                alt={p.name}
                className="h-full w-full object-contain"
                loading="lazy"
              />
            </div>
            <p className="line-clamp-2 text-xs font-medium">{p.name}</p>
            <p className="text-sm font-bold tabular-nums text-primary">{formatCurrency(p.price)}</p>
            <Button
              size="sm"
              variant={isInCompare(p.id) ? 'secondary' : 'outline'}
              className="h-7 w-full text-xs"
              onClick={() => handleAdd(p.id, p.name)}
              disabled={isInCompare(p.id) || !canAddMore}
            >
              <Plus className="mr-1 h-3 w-3" />
              {isInCompare(p.id) ? 'Adicionado' : 'Comparar'}
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
