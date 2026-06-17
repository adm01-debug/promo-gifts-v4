/**
 * Página: Busca Avançada por Preço
 * Refatorada: lógica em useAdvancedPriceSearch, views em ResultViews, tipos em types.ts
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search,
  Filter,
  Grid3X3,
  List,
  Table2,
  Package,
  Palette,
  Layers,
  DollarSign,
  Hash,
  RotateCcw,
  TrendingDown,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { AnimatePresence, m as motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { PageSEO } from '@/components/seo/PageSEO';
import { useAdvancedPriceSearch } from '@/pages/advanced-price-search/useAdvancedPriceSearch';
import {
  type SearchFilters,
  DEFAULT_FILTERS,
  formatCurrency,
  QUANTITY_OPTIONS,
} from '@/pages/advanced-price-search/types';
import {
  ProductCardResult,
  ProductTableResult,
  ProductListResult,
} from '@/pages/advanced-price-search/ResultViews';

function FilterSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Icon className="h-4 w-4" />
        {title}
      </div>
      {children}
    </div>
  );
}

export default function AdvancedPriceSearchPage() {
  const {
    filters,
    setFilters,
    viewMode,
    setViewMode,
    isSearching,
    setIsSearching,
    filteredProducts,
    categories,
    availableColors,
    techniques,
    isLoading,
  } = useAdvancedPriceSearch();

  // The hook exposes primitive state setters; derive the page-level handlers here.
  const loadingTechniques = isLoading;

  const updateFilter = <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const toggleColor = (hex: string) => {
    setFilters((prev) => ({
      ...prev,
      colors: prev.colors.includes(hex)
        ? prev.colors.filter((c) => c !== hex)
        : [...prev.colors, hex],
    }));
  };

  const handleSearch = () => setIsSearching(true);

  const handleReset = () => {
    setFilters(DEFAULT_FILTERS);
    setIsSearching(false);
  };

  return (
    <>
      <PageSEO
        title="Busca Avançada de Preços"
        description="Pesquise preços de brindes com filtros avançados."
        path="/busca-precos"
        noIndex
      />
      <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-3 px-3 py-3 pb-24 sm:space-y-4 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Search className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1
              data-testid="page-title-busca-avancada-preco"
              className="font-display text-2xl font-bold"
            >
              Busca Avançada por Preço
            </h1>
            <p className="text-sm text-muted-foreground">
              Encontre produtos que atendam ao orçamento do cliente
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
          {/* Filters */}
          <Card className="h-fit lg:sticky lg:top-20">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Filter className="h-5 w-5" />
                Filtros de Busca
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <FilterSection title="Buscar Produto" icon={Search}>
                <Input
                  placeholder="Nome ou SKU..."
                  value={filters.searchQuery}
                  onChange={(e) => updateFilter('searchQuery', e.target.value)}
                />
              </FilterSection>

              <FilterSection title="Categoria" icon={Package}>
                <Select value={filters.category} onValueChange={(v) => updateFilter('category', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as categorias" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as categorias</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterSection>

              <FilterSection title="Tiragem Mínima" icon={Hash}>
                <Select
                  value={filters.minQuantity.toString()}
                  onValueChange={(v) => updateFilter('minQuantity', parseInt(v, 10))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUANTITY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value.toString()}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterSection>

              <FilterSection title="Cores" icon={Palette}>
                <ScrollArea className="h-24">
                  <div className="flex flex-wrap gap-2">
                    {availableColors.slice(0, 20).map((color) => (
                      <button
                        key={color.hex}
                        onClick={() => toggleColor(color.hex)}
                        className={cn(
                          'h-7 w-7 rounded-full border-2 transition-all',
                          filters.colors.includes(color.hex)
                            ? 'scale-110 border-primary ring-2 ring-primary/30'
                            : 'border-border hover:scale-105',
                        )}
                        style={{ backgroundColor: color.hex }}
                        title={color.name}
                      />
                    ))}
                  </div>
                </ScrollArea>
                {filters.colors.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 w-full"
                    onClick={() => updateFilter('colors', [])}
                  >
                    Limpar cores
                  </Button>
                )}
              </FilterSection>

              <FilterSection title="Técnica de Personalização" icon={Layers}>
                <Select
                  value={filters.technique}
                  onValueChange={(v) => updateFilter('technique', v)}
                  disabled={loadingTechniques}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a técnica" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Sem personalização</SelectItem>
                    {techniques.map((tech: { id: string; name: string }) => (
                      <SelectItem key={tech.id} value={tech.name}>
                        {tech.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterSection>

              <FilterSection title="Tipo de Preço" icon={DollarSign}>
                <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                  <div className="space-y-0.5">
                    <Label className="text-sm">
                      {filters.priceType === 'with_personalization'
                        ? 'Com personalização'
                        : 'Sem personalização'}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {filters.priceType === 'with_personalization'
                        ? 'Produto + Gravação + Setup + Manuseio'
                        : 'Apenas preço do produto'}
                    </p>
                  </div>
                  <Switch
                    checked={filters.priceType === 'with_personalization'}
                    onCheckedChange={(checked) =>
                      updateFilter(
                        'priceType',
                        checked ? 'with_personalization' : 'without_personalization',
                      )
                    }
                    disabled={filters.technique === 'all'}
                  />
                </div>
              </FilterSection>

              <FilterSection title="Faixa de Preço Unitário" icon={TrendingDown}>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">Mínimo</Label>
                      <Input
                        type="number"
                        value={filters.priceRange[0]}
                        onChange={(e) =>
                          updateFilter('priceRange', [
                            parseFloat(e.target.value) || 0,
                            filters.priceRange[1],
                          ])
                        }
                        className="mt-1"
                      />
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">Máximo</Label>
                      <Input
                        type="number"
                        value={filters.priceRange[1]}
                        onChange={(e) =>
                          updateFilter('priceRange', [
                            filters.priceRange[0],
                            parseFloat(e.target.value) || 100,
                          ])
                        }
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <Slider
                    value={filters.priceRange}
                    onValueChange={(v) => updateFilter('priceRange', v as [number, number])}
                    min={0}
                    max={200}
                    step={1}
                    className="mt-2"
                  />
                  <div className="mt-2 flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {formatCurrency(filters.priceRange[0])}
                    </span>
                    <span className="text-muted-foreground">
                      {formatCurrency(filters.priceRange[1])}
                    </span>
                  </div>
                </div>
              </FilterSection>

              <div className="flex gap-2 border-t pt-4">
                <Button onClick={handleSearch} className="flex-1" disabled={isLoading}>
                  <Search className="mr-2 h-4 w-4" />
                  Buscar
                </Button>
                <Button variant="outline" onClick={handleReset}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {isSearching ? (
                  <>
                    <span className="font-medium text-foreground">{filteredProducts.length}</span>{' '}
                    produtos encontrados
                    {filters.technique !== 'all' && (
                      <>
                        {' '}
                        com <span className="text-primary">{filters.technique}</span>
                      </>
                    )}
                  </>
                ) : (
                  'Configure os filtros e clique em "Buscar"'
                )}
              </p>
              <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-1">
                {(
                  [
                    ['cards', Grid3X3],
                    ['table', Table2],
                    ['list', List],
                  ] as const
                ).map(([mode, Icon]) => (
                  <Button
                    key={mode}
                    variant={viewMode === mode ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode(mode)}
                  >
                    <Icon className="h-4 w-4" />
                  </Button>
                ))}
              </div>
            </div>

            {isLoading && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i}>
                    <Skeleton className="aspect-square" />
                    <CardContent className="space-y-2 p-4">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                      <Skeleton className="mt-4 h-6 w-1/3" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {!isLoading && isSearching && filteredProducts.length === 0 && (
              <Card className="py-12">
                <CardContent className="flex flex-col items-center justify-center text-center">
                  <AlertCircle className="mb-4 h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mb-2 font-display text-lg font-medium">
                    Nenhum produto encontrado
                  </h3>
                  <p className="max-w-md text-sm text-muted-foreground">
                    Tente ajustar os filtros, como aumentar a faixa de preço ou reduzir a tiragem
                    mínima.
                  </p>
                </CardContent>
              </Card>
            )}

            {!isLoading && !isSearching && (
              <Card className="border-dashed py-12">
                <CardContent className="flex flex-col items-center justify-center text-center">
                  <Sparkles className="mb-4 h-12 w-12 text-primary/50" />
                  <h3 className="mb-2 font-display text-lg font-medium">
                    Encontre o produto ideal
                  </h3>
                  <p className="max-w-md text-sm text-muted-foreground">
                    Configure os filtros ao lado: selecione a tiragem, técnica de gravação e faixa
                    de preço desejada.
                  </p>
                </CardContent>
              </Card>
            )}

            <AnimatePresence mode="wait">
              {!isLoading && isSearching && filteredProducts.length > 0 && (
                <motion.div
                  key={viewMode}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {viewMode === 'cards' && (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {filteredProducts.map((p) => (
                        <ProductCardResult key={p.id} product={p} quantity={filters.minQuantity} />
                      ))}
                    </div>
                  )}
                  {viewMode === 'table' && (
                    <ProductTableResult
                      products={filteredProducts}
                      quantity={filters.minQuantity}
                    />
                  )}
                  {viewMode === 'list' && (
                    <ProductListResult products={filteredProducts} quantity={filters.minQuantity} />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </>
  );
}
