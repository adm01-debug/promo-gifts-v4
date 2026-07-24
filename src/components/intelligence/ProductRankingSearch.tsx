import { useState, useMemo, useCallback } from 'react';
import { Search, Trophy, DollarSign, ShoppingBag, BarChart3, Medal } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTrendingProducts } from '@/hooks/intelligence';
import { useCategories, useSuppliers } from '@/hooks/products';
import { useNavigate } from 'react-router-dom';
import { RankingFilterToolbar, type RankingFilters } from './RankingFilterToolbar';
import { RankingResultRow } from './RankingResultRow';

export function ProductRankingSearch() {
  const navigate = useNavigate();
  const { suppliers } = useSuppliers();
  const { data: categories = [] } = useCategories();

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [days, setDays] = useState(90);
  const [limit, setLimit] = useState(10);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [supplierName, setSupplierName] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState<string | null>(null);

  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const handleSearch = useCallback(
    (value: string) => {
      setSearchTerm(value);
      setDebouncedSearch(''); // clear immediately for UX
      if (debounceTimer) clearTimeout(debounceTimer);
      const timer = setTimeout(() => setDebouncedSearch(value), 400);
      setDebounceTimer(timer);
    },
    [debounceTimer],
  );

  const { data: products, isLoading } = useTrendingProducts(
    days,
    categoryId,
    supplierId,
    null,
    limit,
    debouncedSearch.trim() || null,
  );

  const hasResults = !!products?.length;
  const rankedProducts = products ?? [];
  const hasActiveFilters = !!(supplierId || categoryId || debouncedSearch);

  // FIX TS2322: RankingResultRowProps.formatCurrency expects (v: number | null | undefined) => string
  const formatCurrency = (v: number | null | undefined) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(v ?? 0);

  const summary = useMemo(() => {
    if (!products?.length) return null;
    const totalRev = products.reduce((s, p) => s + p.totalRevenue, 0);
    const totalQty = products.reduce((s, p) => s + p.totalQuantity, 0);
    const totalOrders = products.reduce((s, p) => s + p.orderCount, 0);
    const avgTicket = totalOrders > 0 ? totalRev / totalOrders : 0;
    return { totalRev, totalQty, totalOrders, avgTicket };
  }, [products]);

  const topRevenue = products?.[0]?.totalRevenue || 0;

  const clearAllFilters = () => {
    setSupplierId(null);
    setSupplierName(null);
    setCategoryId(null);
    setCategoryName(null);
    setSearchTerm('');
    setDebouncedSearch('');
  };

  const filters: RankingFilters = {
    searchTerm,
    debouncedSearch,
    days,
    limit,
    supplierId,
    supplierName,
    categoryId,
    categoryName,
    hasActiveFilters,
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="skin-icon flex h-7 w-7 items-center justify-center rounded-lg">
                <Trophy className="h-3.5 w-3.5" />
              </div>
              🏆 Ranking de Produtos Mais Vendidos
            </CardTitle>
            <CardDescription className="mt-1 text-xs">
              Pesquise por tipo de produto, filtre por fornecedor/categoria e veja o ranking dos
              mais vendidos
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <RankingFilterToolbar
          filters={filters}
          suppliers={suppliers}
          categories={categories}
          onSearchChange={handleSearch}
          onDaysChange={setDays}
          onLimitChange={setLimit}
          onSupplierChange={(id, name) => {
            setSupplierId(id);
            setSupplierName(name);
          }}
          onCategoryChange={(id, name) => {
            setCategoryId(id);
            setCategoryName(name);
          }}
          onClearAll={clearAllFilters}
        />

        {/* Summary KPIs */}
        {summary && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg bg-muted/30 px-3 py-2 text-center">
              <div className="mb-0.5 flex items-center justify-center gap-1">
                <DollarSign className="h-3 w-3 text-success" />
              </div>
              <p className="text-base font-bold text-foreground sm:text-lg">
                {formatCurrency(summary.totalRev)}
              </p>
              <p className="text-[10px] text-muted-foreground">Faturamento</p>
            </div>
            <div className="rounded-lg bg-muted/30 px-3 py-2 text-center">
              <div className="mb-0.5 flex items-center justify-center gap-1">
                <ShoppingBag className="h-3 w-3 text-primary" />
              </div>
              <p className="text-base font-bold text-foreground sm:text-lg">
                {summary.totalQty.toLocaleString('pt-BR')}
              </p>
              <p className="text-[10px] text-muted-foreground">Unidades</p>
            </div>
            <div className="rounded-lg bg-muted/30 px-3 py-2 text-center">
              <div className="mb-0.5 flex items-center justify-center gap-1">
                <BarChart3 className="h-3 w-3 text-primary" />
              </div>
              <p className="text-base font-bold text-foreground sm:text-lg">
                {summary.totalOrders}
              </p>
              <p className="text-[10px] text-muted-foreground">Pedidos</p>
            </div>
            <div className="rounded-lg bg-muted/30 px-3 py-2 text-center">
              <div className="mb-0.5 flex items-center justify-center gap-1">
                <Medal className="h-3 w-3 text-warning" />
              </div>
              <p className="text-base font-bold text-foreground sm:text-lg">
                {formatCurrency(summary.avgTicket)}
              </p>
              <p className="text-[10px] text-muted-foreground">Ticket Médio</p>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        )}

        {!isLoading && !hasResults && (
          <div className="flex flex-col items-center py-8 text-muted-foreground">
            <Search className="mb-3 h-10 w-10 opacity-30" />
            <p className="text-sm font-medium">Nenhum produto encontrado</p>
            <p className="mt-1 text-xs">
              {debouncedSearch
                ? `Nenhum resultado para "${debouncedSearch}"`
                : 'Sem dados de vendas para os filtros selecionados'}
            </p>
            {debouncedSearch && (
              <p className="mt-2 text-xs text-muted-foreground/60">
                Dica: tente termos mais genéricos como "garrafa", "caneta" ou "mochila"
              </p>
            )}
          </div>
        )}

        {!isLoading && hasResults && (
          <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            <div className="hidden grid-cols-[2rem_2.5rem_1fr_4.5rem_5rem_5rem_4rem] gap-2 bg-muted/40 px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:grid">
              <span>#</span>
              <span />
              <span>Produto</span>
              <span className="text-right">Qtd</span>
              <span className="text-right">Receita</span>
              <span className="text-right">P.Médio</span>
              <span className="text-right">Conv.</span>
            </div>
            {rankedProducts.map((product, index) => (
              <RankingResultRow
                key={product.productSku || product.productId || index}
                product={product}
                index={index}
                topRevenue={topRevenue}
                searchQuery={debouncedSearch}
                formatCurrency={formatCurrency}
                onClick={() => product.productId && navigate(`/produto/${product.productId}`)}
              />
            ))}
          </div>
        )}

        {hasResults && (
          <p className="text-center text-[10px] text-muted-foreground">
            Top {rankedProducts.length} {debouncedSearch ? `para "${debouncedSearch}"` : 'produtos'}
            {categoryName ? ` · ${categoryName}` : ''}
            {supplierName ? ` · ${supplierName}` : ''} · {days} dias · ordenado por faturamento
          </p>
        )}
      </CardContent>
    </Card>
  );
}
