import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageSEO } from '@/components/seo/PageSEO';
import {
  useProductMatch,
  useProducts,
  type MatchFilters,
  type MatchResult,
  type Product,
} from '@/hooks/products';
import { MOCK_MATCH_PRODUCTS } from '@/data/mock-match-products';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Search, Filter, ArrowRight, Zap, Target, Lightbulb, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const MATCH_COLOR_CLASSES: Record<MatchResult['matchType'], string> = {
  identical: 'bg-blue-100 text-blue-700 border-blue-200',
  similar: 'bg-green-100 text-green-700 border-green-200',
  complementary: 'bg-amber-100 text-amber-700 border-amber-200',
} as const;

const MATCH_LABELS: Record<MatchResult['matchType'], string> = {
  identical: 'Idêntico',
  similar: 'Similar',
  complementary: 'Complementar',
} as const;

export default function ProductMatchPage() {
  const navigate = useNavigate();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [filters, setFilters] = useState<Partial<MatchFilters>>({});
  const [searchQuery, setSearchQuery] = useState('');

  const { data: dbProducts = [] } = useProducts({ limit: 500 });
  const allProducts = dbProducts.length > 0 ? dbProducts : MOCK_MATCH_PRODUCTS;
  const { matches } = useProductMatch(selectedProduct, allProducts, filters);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    allProducts.forEach((p: Product) => p.category?.name && cats.add(p.category.name));
    return [...cats].sort();
  }, [allProducts]);

  const suppliers = useMemo(() => {
    const sups = new Set<string>();
    allProducts.forEach((p: Product) => p.supplier?.name && sups.add(p.supplier.name));
    return [...sups].sort();
  }, [allProducts]);

  const stats = useMemo(() => {
    const byType = { identical: 0, similar: 0, complementary: 0 };
    matches.forEach((m) => byType[m.matchType]++);
    return byType;
  }, [matches]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return allProducts.slice(0, 50);
    const q = searchQuery.toLowerCase();
    return allProducts
      .filter((p) => p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q))
      .slice(0, 50);
  }, [allProducts, searchQuery]);

  const handleSelectProduct = useCallback((product: Product) => {
    setSelectedProduct(product);
    setFilters({});
  }, []);

  const matchIcon: Record<MatchResult['matchType'], React.ReactNode> = {
    identical: <Zap className="h-3.5 w-3.5" />,
    similar: <Target className="h-3.5 w-3.5" />,
    complementary: <Lightbulb className="h-3.5 w-3.5" />,
  };

  return (
    <>
      <PageSEO
        title="Match de Produtos"
        description="Encontre produtos similares e complementares."
        path="/match"
      />
      <div className="mx-auto w-full max-w-[1920px] space-y-4 px-3 py-4 sm:px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="font-display text-xl font-bold">Match de Produtos</h1>
            <p className="text-sm text-muted-foreground">
              Selecione um produto para encontrar similares e complementares
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Product Selector */}
          <div className="space-y-3 lg:col-span-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar produto..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <ScrollArea className="h-[500px] rounded-lg border">
              <div className="space-y-1 p-2">
                {filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted',
                      selectedProduct?.id === p.id && 'border border-primary/20 bg-primary/10',
                    )}
                    onClick={() => handleSelectProduct(p)}
                  >
                    <img
                      src={p.images?.[0]}
                      alt={p.name}
                      className="h-10 w-10 shrink-0 rounded bg-muted object-contain"
                      loading="lazy"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground">{p.sku}</p>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Match Results */}
          <div className="space-y-3 lg:col-span-2">
            {selectedProduct ? (
              <>
                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
                        {filters.categoryFilter ?? 'Categoria'}
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuRadioGroup
                        value={filters.categoryFilter ?? ''}
                        onValueChange={(v) =>
                          setFilters((f) => ({ ...f, categoryFilter: v || undefined }))
                        }
                      >
                        <DropdownMenuRadioItem value="">Todas</DropdownMenuRadioItem>
                        {categories.map((c) => (
                          <DropdownMenuRadioItem key={c} value={c}>
                            {c}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
                        {filters.supplierFilter ?? 'Fornecedor'}
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuRadioGroup
                        value={filters.supplierFilter ?? ''}
                        onValueChange={(v) =>
                          setFilters((f) => ({ ...f, supplierFilter: v || undefined }))
                        }
                      >
                        <DropdownMenuRadioItem value="">Todos</DropdownMenuRadioItem>
                        {suppliers.map((s) => (
                          <DropdownMenuRadioItem key={s} value={s}>
                            {s}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Stats */}
                  <div className="ml-auto flex items-center gap-2">
                    {(['identical', 'similar', 'complementary'] as MatchResult['matchType'][]).map(
                      (type) => (
                        <Badge
                          key={type}
                          variant="outline"
                          className={cn('text-[10px]', MATCH_COLOR_CLASSES[type])}
                        >
                          {MATCH_LABELS[type]}: {stats[type]}
                        </Badge>
                      ),
                    )}
                  </div>
                </div>

                {/* Selected product info */}
                <Card>
                  <CardContent className="flex items-center gap-3 p-3">
                    <img
                      src={selectedProduct.images?.[0]}
                      alt={selectedProduct.name}
                      className="h-12 w-12 rounded bg-muted object-contain"
                      loading="lazy"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{selectedProduct.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedProduct.sku} · {selectedProduct.supplier?.name}
                      </p>
                    </div>
                    <p className="shrink-0 text-lg font-bold tabular-nums text-primary">
                      R$ {selectedProduct.price?.toFixed(2)}
                    </p>
                  </CardContent>
                </Card>

                <Separator />

                {/* Match results list */}
                {matches.length > 0 ? (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {matches.map((match) => (
                        <Card
                          key={match.product.id}
                          className="cursor-pointer transition-colors hover:border-primary/40"
                          onClick={() => navigate(`/produto/${match.product.id}`)}
                        >
                          <CardContent className="flex items-center gap-3 p-3">
                            <img
                              src={match.product.images?.[0]}
                              alt={match.product.name}
                              className="h-10 w-10 shrink-0 rounded bg-muted object-contain"
                              loading="lazy"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="mb-0.5 flex items-center gap-2">
                                <p className="truncate text-xs font-medium">{match.product.name}</p>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'flex shrink-0 items-center gap-1 text-[10px]',
                                    MATCH_COLOR_CLASSES[match.matchType],
                                  )}
                                >
                                  {matchIcon[match.matchType]}
                                  {MATCH_LABELS[match.matchType]}
                                </Badge>
                              </div>
                              <p className="text-[10px] text-muted-foreground">
                                {match.product.sku} · {match.product.supplier?.name}
                              </p>
                              {match.reasons?.length > 0 && (
                                <p className="mt-0.5 text-[10px] text-primary/70">
                                  {match.reasons.slice(0, 2).join(' · ')}
                                </p>
                              )}
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-sm font-bold tabular-nums">
                                R$ {match.product.price?.toFixed(2)}
                              </p>
                              <p
                                className={cn(
                                  'text-[10px]',
                                  match.product.price < selectedProduct.price
                                    ? 'text-green-600'
                                    : 'text-muted-foreground',
                                )}
                              >
                                {match.product.price < selectedProduct.price
                                  ? '↓ mais barato'
                                  : match.product.price === selectedProduct.price
                                    ? '= mesmo preço'
                                    : '↑ mais caro'}
                              </p>
                            </div>
                            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="py-12 text-center text-muted-foreground">
                    <Target className="mx-auto mb-3 h-12 w-12 opacity-30" />
                    <p className="text-sm">Nenhum match encontrado</p>
                    <p className="mt-1 text-xs">Tente ajustar os filtros</p>
                  </div>
                )}
              </>
            ) : (
              <div className="py-20 text-center text-muted-foreground">
                <Zap className="mx-auto mb-4 h-16 w-16 opacity-20" />
                <p className="font-display text-lg font-semibold">Selecione um produto</p>
                <p className="mt-1 text-sm">Escolha um produto na lista ao lado para ver matches</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
