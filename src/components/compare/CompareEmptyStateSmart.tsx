/**
 * CompareEmptyStateSmart — empty state inteligente: mostra top 6 mais comparados da semana.
 * Usa RPC get_top_compared_products (criada na C1).
 */
import { useEffect, useState } from 'react';
import { GitCompare, Plus, Flame, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useProductsContext } from '@/contexts/ProductsContext';
import { useComparisonStore } from '@/stores/useComparisonStore';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

export function CompareEmptyStateSmart() {
  const [topIds, setTopIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [usedFallback, setUsedFallback] = useState(false);
  const { getProductsByIds, products: allProducts } = useProductsContext();
  const addToCompare = useComparisonStore((s) => s.addToCompare);
  const isInCompare = useComparisonStore((s) => s.isInCompare);
  const canAddMore = useComparisonStore((s) => s.canAddMore);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.rpc('get_top_compared_products', { p_limit: 6 });
        if (cancelled) return;
        const ids = (data ?? []).map((r: { product_id: string }) => r.product_id);
        setTopIds(ids);
        if (ids.length === 0) {
          logger.warn('[CompareEmptyStateSmart] RPC retornou 0 ids — fallback acionado');
        }
      } catch (err) {
        logger.warn('[CompareEmptyStateSmart] RPC falhou — fallback acionado', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Controla o fallback via useEffect para evitar warnings de update durante o render
  useEffect(() => {
    if (!loading && topIds.length === 0 && allProducts.length > 0 && !usedFallback) {
      setUsedFallback(true);
      logger.warn('[CompareEmptyStateSmart] Usando fallback de produtos do contexto');
    }
  }, [loading, topIds.length, allProducts.length, usedFallback]);

  const products =
    topIds.length > 0 ? getProductsByIds(topIds) : usedFallback ? allProducts.slice(0, 6) : [];

  const handleAdd = (id: string, name: string) => {
    if (!canAddMore) {
      toast.error('Máximo 4 produtos');
      return;
    }
    if (addToCompare(id)) toast.success(`${name} adicionado`);
  };

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-8 py-8">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
          <GitCompare className="h-10 w-10 text-muted-foreground" />
        </div>
        <div className="text-center">
          <h1 className="mb-2 font-display text-2xl font-bold text-foreground">
            Comparador de Produtos
          </h1>
          <p className="max-w-md text-muted-foreground">
            Selecione pelo menos 2 produtos para comparar lado a lado.
          </p>
        </div>
        <Button onClick={() => navigate('/')}>Explorar catálogo</Button>
      </div>

      {!loading && products.length > 0 && (
        <section className="w-full max-w-5xl space-y-3 duration-500 animate-in fade-in slide-in-from-bottom-4">
          <header className="flex items-center justify-center gap-2">
            {usedFallback ? (
              <Sparkles className="h-4 w-4 text-primary" />
            ) : (
              <Flame className="h-4 w-4 text-primary" />
            )}
            <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {usedFallback ? 'Sugestões para começar' : 'Os mais comparados da semana'}
            </h2>
          </header>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {products.slice(0, 6).map((p) => (
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
                <Button
                  size="sm"
                  variant={isInCompare(p.id) ? 'secondary' : 'outline'}
                  className="h-7 w-full text-xs"
                  onClick={() => handleAdd(p.id, p.name)}
                  disabled={isInCompare(p.id)}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  {isInCompare(p.id) ? 'Adicionado' : 'Comparar'}
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
