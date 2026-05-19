/**
 * SimilarProductsRail — bottom rail "Compare também com..." 4-6 produtos similares.
 * Mesma categoria + faixa de preço ±20% dos produtos já em comparação.
 */
import { useMemo } from "react";
import { useProducts } from "@/hooks/products";
import { useComparisonStore } from "@/stores/useComparisonStore";
import { Button } from "@/components/ui/button";
import { Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface Props {
  products: Record<string, unknown>[];
  formatCurrency: (v: number) => string;
}

export function SimilarProductsRail({ products, formatCurrency }: Props) {
  const { addToCompare, isInCompare, canAddMore } = useComparisonStore();
  const primaryCategory = products[0]?.category?.name;
  const { data: pool = [] } = useProducts(
    primaryCategory ? { category: primaryCategory } : undefined,
    { enabled: !!primaryCategory, staleTime: 10 * 60 * 1000 }
  );

  const suggestions = useMemo(() => {
    if (!pool.length || !products.length) return [];
    const compareIds = new Set(products.map(p => p.id));
    const avgPrice = products.reduce((sum, p) => sum + Number(p.price ?? 0), 0) / products.length;
    const minP = avgPrice * 0.8;
    const maxP = avgPrice * 1.2;
    return pool
      .filter(p => !compareIds.has(p.id) && p.price >= minP && p.price <= maxP)
      .slice(0, 6);
  }, [pool, products]);

  if (suggestions.length === 0) return null;

  const handleAdd = (id: string, name: string) => {
    if (!canAddMore) {
      toast.error("Máximo 4 produtos");
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {suggestions.map(p => (
          <div key={p.id} className="rounded-xl border border-border bg-card p-3 space-y-2 hover:shadow-md hover:border-primary/40 transition-all">
            <div className="aspect-square rounded-lg overflow-hidden bg-muted">
              <img src={p.images?.[0]} alt={p.name} className="w-full h-full object-contain" loading="lazy" />
            </div>
            <p className="text-xs font-medium line-clamp-2">{p.name}</p>
            <p className="text-sm font-bold text-primary tabular-nums">{formatCurrency(p.price)}</p>
            <Button
              size="sm"
              variant={isInCompare(p.id) ? "secondary" : "outline"}
              className="w-full h-7 text-xs"
              onClick={() => handleAdd(p.id, p.name)}
              disabled={isInCompare(p.id) || !canAddMore}
            >
              <Plus className="h-3 w-3 mr-1" />
              {isInCompare(p.id) ? "Adicionado" : "Comparar"}
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
