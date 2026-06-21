import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageSEO } from '@/components/seo/PageSEO';
import {
  useProductMatch,
  useProducts,
  useCategories,
  type MatchFilters,
  type MatchResult,
  type Product,
} from '@/hooks/products';
import { MOCK_MATCH_PRODUCTS } from '@/data/mock-match-products';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { dedupeById } from '@/utils/product-search';
import { Zap, Target, Loader2 } from 'lucide-react';
import { ProductSearchPanel } from './product-match/ProductSearchPanel';
import { MatchFiltersPanel, type CategoryOption } from './product-match/MatchFiltersPanel';
import { SelectedProductCard, MatchCard, MATCH_TYPE_CONFIG } from './product-match/MatchCards';

const MATCH_TYPES: MatchResult['matchType'][] = ['identical', 'similar', 'complementary'];

export default function ProductMatchPage() {
  const navigate = useNavigate();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [filters, setFilters] = useState<Partial<MatchFilters>>({});

  // Catálogo base para navegação + pool inicial. 1000 (antes 500 alfabético).
  const { data: dbProducts = [], isLoading } = useProducts({ limit: 1000 });

  // Cohort da categoria do produto selecionado: garante que TODA a categoria
  // entre no pool de match, mesmo que esteja fora dos primeiros 1000 alfabéticos.
  const { data: categoryCohort = [], isFetching: cohortLoading } = useProducts(
    selectedProduct?.category_id
      ? { categoryId: selectedProduct.category_id, limit: 1000 }
      : undefined,
    { enabled: !!selectedProduct?.category_id, staleTime: 10 * 60 * 1000 },
  );

  const { data: categoriesData = [] } = useCategories();
  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    categoriesData.forEach((c) => map.set(String(c.id), c.name));
    return map;
  }, [categoriesData]);

  // Em produção nunca exibimos mock; o mock é apenas para preview em desenvolvimento.
  const browseProducts = useMemo(
    () => (dbProducts.length > 0 ? dbProducts : import.meta.env.DEV ? MOCK_MATCH_PRODUCTS : []),
    [dbProducts],
  );

  // Pool de match = navegação + cohort da categoria + o próprio selecionado (dedup).
  const matchPool = useMemo(() => {
    if (!selectedProduct) return browseProducts;
    return dedupeById([selectedProduct, ...browseProducts, ...categoryCohort]);
  }, [browseProducts, categoryCohort, selectedProduct]);

  const { matches } = useProductMatch(selectedProduct, matchPool, filters);

  const stats = useMemo(() => {
    const byType: Record<MatchResult['matchType'], number> = {
      identical: 0,
      similar: 0,
      complementary: 0,
    };
    matches.forEach((m) => byType[m.matchType]++);
    return byType;
  }, [matches]);

  // Opções de categoria (id + nome resolvido) presentes no pool de match.
  const categoryOptions: CategoryOption[] = useMemo(() => {
    const seen = new Map<string, string>();
    matchPool.forEach((p) => {
      if (!p.category_id) return;
      const id = String(p.category_id);
      if (seen.has(id)) return;
      const name = categoryNameById.get(id) || p.category_name || p.category?.name || '';
      if (name && name !== 'Sem categoria') seen.set(id, name);
    });
    return [...seen.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [matchPool, categoryNameById]);

  const supplierOptions = useMemo(() => {
    const sups = new Set<string>();
    matchPool.forEach((p) => p.supplier?.name && sups.add(p.supplier.name));
    return [...sups].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [matchPool]);

  const handleSelectProduct = useCallback((product: Product) => {
    setSelectedProduct(product);
    setFilters({});
  }, []);

  const handleNavigate = useCallback((id: string) => navigate(`/produto/${id}`), [navigate]);

  return (
    <>
      <PageSEO
        title="Match de Produtos"
        description="Encontre produtos similares e complementares."
        path="/match"
      />
      <div className="mx-auto w-full max-w-[1920px] space-y-4 px-3 py-4 sm:px-4 lg:px-6">
        <div>
          <h1 className="font-display text-xl font-bold">Match de Produtos</h1>
          <p className="text-sm text-muted-foreground">
            Selecione um produto para encontrar similares e complementares
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Product selector */}
          <div className="lg:col-span-4 xl:col-span-3">
            <ProductSearchPanel
              products={browseProducts}
              onSelect={handleSelectProduct}
              selectedId={selectedProduct?.id}
            />
          </div>

          {/* Filters */}
          <div className="lg:col-span-3 xl:col-span-2">
            {selectedProduct && (
              <MatchFiltersPanel
                filters={filters}
                setFilters={setFilters}
                categories={categoryOptions}
                suppliers={supplierOptions}
              />
            )}
          </div>

          {/* Results */}
          <div className="space-y-3 lg:col-span-5 xl:col-span-7">
            {!selectedProduct ? (
              <div className="py-20 text-center text-muted-foreground">
                {isLoading ? (
                  <>
                    <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin opacity-40" />
                    <p className="text-sm">Carregando catálogo…</p>
                  </>
                ) : (
                  <>
                    <Zap className="mx-auto mb-4 h-16 w-16 opacity-20" />
                    <p className="font-display text-lg font-semibold">Selecione um produto</p>
                    <p className="mt-1 text-sm">
                      Escolha um produto na lista ao lado para ver matches
                    </p>
                  </>
                )}
              </div>
            ) : (
              <>
                <SelectedProductCard product={selectedProduct} />

                <div className="flex flex-wrap items-center gap-2">
                  {MATCH_TYPES.map((type) => (
                    <Badge
                      key={type}
                      className={cn('gap-1 text-[10px]', MATCH_TYPE_CONFIG[type].color)}
                    >
                      {MATCH_TYPE_CONFIG[type].label}: {stats[type]}
                    </Badge>
                  ))}
                  {cohortLoading && (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      ampliando busca na categoria…
                    </span>
                  )}
                </div>

                <Separator />

                {matches.length > 0 ? (
                  <ScrollArea className="h-[calc(100vh-22rem)]">
                    <div className="space-y-2 pr-3">
                      {matches.map((match) => (
                        <MatchCard key={match.product.id} match={match} onNavigate={handleNavigate} />
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="py-12 text-center text-muted-foreground">
                    <Target className="mx-auto mb-3 h-12 w-12 opacity-30" />
                    <p className="text-sm">
                      {cohortLoading ? 'Buscando matches…' : 'Nenhum match encontrado'}
                    </p>
                    <p className="mt-1 text-xs">Tente reduzir o score mínimo ou limpar os filtros</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
