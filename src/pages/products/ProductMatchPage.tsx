/**
 * ProductMatchPage — "Match" tool for sellers.
 * Side-by-side layout: selected product on the left, matches on the right.
 * v3: Sub-components extracted to product-match/ folder.
 */
import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageSEO } from '@/components/seo/PageSEO';
import { useProducts, type Product } from '@/hooks/products';
import { useProductMatch, type MatchFilters, type MatchResult } from '@/hooks/products';
import { MOCK_MATCH_PRODUCTS } from '@/data/mock-match-products';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MatchFiltersPanel } from "@/pages/products/product-match/MatchFiltersPanel";
import { ProductSearchPanel } from "@/pages/products/product-match/ProductSearchPanel";
import { SelectedProductCard, MatchCard, MATCH_TYPE_CONFIG } from "@/pages/products/product-match/MatchCards";
import { cn } from '@/lib/utils';
import { Search, Target, Package, Zap, Sparkles } from 'lucide-react';

export default function ProductMatchPage() {
  const navigate = useNavigate();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [filters, setFilters] = useState<Partial<MatchFilters>>({
    minScore: 10,
    matchTypes: ['identical', 'similar', 'complementary'],
    onlyInStock: false,
  });

  const { data: dbProducts = [] } = useProducts({ limit: 500 });
  const allProducts = dbProducts.length > 0 ? dbProducts : MOCK_MATCH_PRODUCTS;
  const { matches } = useProductMatch(selectedProduct, allProducts, filters);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    allProducts.forEach(p => p.category?.name && cats.add(p.category.name));
    return [...cats].sort();
  }, [allProducts]);

  const suppliers = useMemo(() => {
    const sups = new Set<string>();
    allProducts.forEach(p => p.supplier?.name && sups.add(p.supplier.name));
    return [...sups].sort();
  }, [allProducts]);

  const stats = useMemo(() => {
    const byType = { identical: 0, similar: 0, complementary: 0 };
    matches.forEach(m => byType[m.matchType]++);
    return byType;
  }, [matches]);

  const toggleMatchType = useCallback((type: MatchResult['matchType']) => {
    setFilters(prev => {
      const current = prev.matchTypes || ['identical', 'similar', 'complementary'];
      const updated = current.includes(type)
        ? current.filter(t => t !== type)
        : [...current, type];
      return { ...prev, matchTypes: updated.length > 0 ? updated : current };
    });
  }, []);

  return (
      <>
        <PageSEO
          title="Match de Produtos"
          description="Encontre produtos idênticos, semelhantes e complementares para venda cruzada."
          path="/match"
        />

        <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-3 sm:py-4 space-y-4 animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 data-testid="page-title-match-produtos" className="font-display text-xl font-bold text-foreground">Match de Produtos</h1>
                <p className="text-xs text-muted-foreground">
                  Encontre produtos idênticos, semelhantes e complementares
                </p>
              </div>
            </div>

            {selectedProduct && matches.length > 0 && (
              <div className="flex items-center gap-2">
                {(Object.entries(MATCH_TYPE_CONFIG) as [MatchResult['matchType'], typeof MATCH_TYPE_CONFIG[keyof typeof MATCH_TYPE_CONFIG]][]).map(([type, cfg]) => {
                  const Icon = cfg.icon;
                  const count = stats[type];
                  const active = (filters.matchTypes || []).includes(type);
                  return (
                    <button
                      key={type}
                      onClick={() => toggleMatchType(type)}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all',
                        active
                          ? `${cfg.color} border-transparent shadow-sm`
                          : 'bg-muted/50 text-muted-foreground border-border/40 opacity-60 hover:opacity-100'
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {cfg.label}
                      <span className="ml-1 text-[10px] opacity-80">({count})</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Main grid */}
          <div className="grid grid-cols-1 lg:grid-cols-[280px_300px_1fr] gap-4 xl:gap-5">
            {/* Column 1: Product search */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <Search className="h-3.5 w-3.5" />
                Buscar Produto
              </div>
              <ProductSearchPanel
                products={allProducts}
                onSelect={setSelectedProduct}
                selectedId={selectedProduct?.id}
              />
            </div>

            {/* Column 2: Selected product + Filters */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <Target className="h-3.5 w-3.5" />
                Produto Selecionado
              </div>

              {selectedProduct ? (
                <>
                  <SelectedProductCard product={selectedProduct} />
                  <MatchFiltersPanel filters={filters} setFilters={setFilters} categories={categories} suppliers={suppliers} />
                </>
              ) : (
                <Card className="border-dashed border-border/40">
                  <CardContent className="p-8 flex flex-col items-center justify-center text-center gap-3">
                    <div className="p-3 rounded-full bg-muted/50">
                      <Target className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Selecione um produto na lista ao lado para encontrar matches
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Column 3: Matches */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <Sparkles className="h-3.5 w-3.5" />
                  Matches Encontrados
                  {matches.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">{matches.length}</Badge>
                  )}
                </div>
              </div>

              {!selectedProduct ? (
                <Card className="border-dashed border-border/40">
                  <CardContent className="p-12 flex flex-col items-center justify-center text-center gap-3">
                    <div className="p-4 rounded-full bg-muted/50">
                      <Zap className="h-10 w-10 text-muted-foreground/30" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground/60">Nenhum produto selecionado</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Busque e selecione um produto para encontrar matches automáticos
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : matches.length === 0 ? (
                <Card className="border-dashed border-border/40">
                  <CardContent className="p-12 flex flex-col items-center justify-center text-center gap-3">
                    <div className="p-4 rounded-full bg-muted/50">
                      <Package className="h-10 w-10 text-muted-foreground/30" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground/60">Nenhum match encontrado</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Tente reduzir o score mínimo ou remover filtros
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <ScrollArea className="h-[calc(100vh-14rem)]">
                  <div className="space-y-2 pr-3">
                    {matches.map((match) => (
                      <MatchCard
                        key={match.product.id}
                        match={match}
                        onNavigate={(id) => navigate(`/produto/${id}`)}
                      />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>
        </div>
      </>
  );
}
