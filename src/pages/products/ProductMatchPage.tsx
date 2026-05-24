import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageSEO } from '@/components/seo/PageSEO';
import { useProductMatch, useProducts, type MatchFilters, type MatchResult, type Product } from "@/hooks/products";
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

export default function ProductMatchPage() {
  const navigate = useNavigate();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [filters, setFilters] = useState<MatchFilters>({});
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
    matches.forEach(m => byType[m.matchType]++);
    return byType;
  }, [matches]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return allProducts.slice(0, 50);
    const q = searchQuery.toLowerCase();
    return allProducts.filter(p => p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)).slice(0, 50);
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

  const matchColor: Record<MatchResult['matchType'], string> = {
    identical: 'bg-blue-100 text-blue-700 border-blue-200',
    similar: 'bg-green-100 text-green-700 border-green-200',
    complementary: 'bg-amber-100 text-amber-700 border-amber-200',
  };

  const matchLabel: Record<MatchResult['matchType'], string> = {
    identical: 'Idêntico',
    similar: 'Similar',
    complementary: 'Complementar',
  };

  return (
    <>
      <PageSEO title="Match de Produtos" description="Encontre produtos similares e complementares." path="/match" />
      <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-4 lg:px-6 py-4 space-y-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="font-display text-xl font-bold">Match de Produtos</h1>
            <p className="text-sm text-muted-foreground">Selecione um produto para encontrar similares e complementares</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Product Selector */}
          <div className="lg:col-span-1 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produto..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <ScrollArea className="h-[500px] border rounded-lg">
              <div className="p-2 space-y-1">
                {filteredProducts.map(p => (
                  <button
                    key={p.id}
                    className={cn(
                      "w-full flex items-center gap-3 p-2 rounded-lg text-left hover:bg-muted transition-colors",
                      selectedProduct?.id === p.id && "bg-primary/10 border border-primary/20"
                    )}
                    onClick={() => handleSelectProduct(p)}
                  >
                    <img src={p.images?.[0]} alt={p.name} className="w-10 h-10 object-contain rounded bg-muted shrink-0" loading="lazy" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground">{p.sku}</p>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Match Results */}
          <div className="lg:col-span-2 space-y-3">
            {selectedProduct ? (
              <>
                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                        {filters.category ?? 'Categoria'}
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuRadioGroup value={filters.category ?? ''} onValueChange={v => setFilters(f => ({ ...f, category: v || undefined }))}>
                        <DropdownMenuRadioItem value="">Todas</DropdownMenuRadioItem>
                        {categories.map(c => <DropdownMenuRadioItem key={c} value={c}>{c}</DropdownMenuRadioItem>)}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                        {filters.supplier ?? 'Fornecedor'}
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuRadioGroup value={filters.supplier ?? ''} onValueChange={v => setFilters(f => ({ ...f, supplier: v || undefined }))}>
                        <DropdownMenuRadioItem value="">Todos</DropdownMenuRadioItem>
                        {suppliers.map(s => <DropdownMenuRadioItem key={s} value={s}>{s}</DropdownMenuRadioItem>)}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Stats */}
                  <div className="ml-auto flex items-center gap-2">
                    {(['identical', 'similar', 'complementary'] as MatchResult['matchType'][]).map(type => (
                      <Badge key={type} variant="outline" className={cn('text-[10px]', matchColor[type])}>
                        {matchLabel[type]}: {stats[type]}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Selected product info */}
                <Card>
                  <CardContent className="flex items-center gap-3 p-3">
                    <img src={selectedProduct.images?.[0]} alt={selectedProduct.name} className="w-12 h-12 object-contain rounded bg-muted" loading="lazy" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{selectedProduct.name}</p>
                      <p className="text-xs text-muted-foreground">{selectedProduct.sku} · {selectedProduct.supplier?.name}</p>
                    </div>
                    <p className="text-lg font-bold text-primary tabular-nums shrink-0">
                      R$ {selectedProduct.price?.toFixed(2)}
                    </p>
                  </CardContent>
                </Card>

                <Separator />

                {/* Match results list */}
                {matches.length > 0 && matches.length > 0 ? (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {matches.map(match => (
                        <Card
                          key={match.product.id}
                          className="cursor-pointer hover:border-primary/40 transition-colors"
                          onClick={() => navigate(`/produto/${match.product.id}`)}
                        >
                          <CardContent className="flex items-center gap-3 p-3">
                            <img src={match.product.images?.[0]} alt={match.product.name} className="w-10 h-10 object-contain rounded bg-muted shrink-0" loading="lazy" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-0.5">
                                <p className="text-xs font-medium truncate">{match.product.name}</p>
                                <Badge variant="outline" className={cn('text-[10px] shrink-0 flex items-center gap-1', matchColor[match.matchType])}>
                                  {matchIcon[match.matchType]}
                                  {matchLabel[match.matchType]}
                                </Badge>
                              </div>
                              <p className="text-[10px] text-muted-foreground">{match.product.sku} · {match.product.supplier?.name}</p>
                              {match.reasons?.length > 0 && (
                                <p className="text-[10px] text-primary/70 mt-0.5">{match.reasons.slice(0, 2).join(' · ')}</p>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-bold tabular-nums">
                                R$ {match.product.price?.toFixed(2)}
                              </p>
                              <p className={cn('text-[10px]', match.product.price < selectedProduct.price ? 'text-green-600' : 'text-muted-foreground')}>
                                {match.product.price < selectedProduct.price ? '↓ mais barato' : match.product.price === selectedProduct.price ? '= mesmo preço' : '↑ mais caro'}
                              </p>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Target className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Nenhum match encontrado</p>
                    <p className="text-xs mt-1">Tente ajustar os filtros</p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-20 text-muted-foreground">
                <Zap className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p className="font-display text-lg font-semibold">Selecione um produto</p>
                <p className="text-sm mt-1">Escolha um produto na lista ao lado para ver matches</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
