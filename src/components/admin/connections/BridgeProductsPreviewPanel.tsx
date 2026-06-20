import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Boxes, ChevronLeft, ChevronRight, Loader2, RefreshCw, Search, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useExternalProducts } from '@/hooks/intelligence';
import type { ExternalProduct } from '@/lib/external-db/types';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];
type ActiveFilter = 'all' | 'active' | 'inactive';

const fmtCurrency = (n?: number) =>
  typeof n === 'number'
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
    : '—';

/**
 * Painel de revisão rápida dos produtos retornados pelo `external-db-bridge`
 * (operação `select` na tabela `products`). Permite filtrar por busca livre,
 * ativos/inativos, faixa de preço e estoque mínimo, com paginação server-side
 * (limit/offset) e contagem exata para revisar o catálogo externo sem precisar
 * acessar o BD diretamente.
 */
export function BridgeProductsPreviewPanel() {
  const { data, count, isLoading, error, fetchAll } = useExternalProducts();

  // ---- Filtros (controlados via inputs, aplicados ao "Buscar") ----
  const [searchInput, setSearchInput] = useState('');
  const [activeInput, setActiveInput] = useState<ActiveFilter>('all');
  const [minPriceInput, setMinPriceInput] = useState('');
  const [maxPriceInput, setMaxPriceInput] = useState('');
  const [minStockInput, setMinStockInput] = useState('');

  // Filtros aplicados (acionam o fetch)
  const [appliedSearch, setAppliedSearch] = useState('');
  const [appliedActive, setAppliedActive] = useState<ActiveFilter>('all');
  const [appliedMinPrice, setAppliedMinPrice] = useState<number | null>(null);
  const [appliedMaxPrice, setAppliedMaxPrice] = useState<number | null>(null);
  const [appliedMinStock, setAppliedMinStock] = useState<number | null>(null);

  // Paginação
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(25);

  const totalPages = useMemo(() => {
    if (count === null || count === undefined) return 1;
    return Math.max(1, Math.ceil(count / pageSize));
  }, [count, pageSize]);

  // Monta o objeto de filtros no formato suportado pelo external-db-bridge
  const buildFilters = useCallback((): Record<string, unknown> => {
    const f: Record<string, unknown> = {};
    if (appliedSearch.trim() !== '') f._search = appliedSearch.trim();
    if (appliedActive === 'active') f.is_active = true;
    if (appliedActive === 'inactive') f.is_active = false;
    if (appliedMinPrice !== null) f.price_gte = appliedMinPrice;
    if (appliedMaxPrice !== null) f.price_lte = appliedMaxPrice;
    if (appliedMinStock !== null) f.stock_gte = appliedMinStock;

    return f;
  }, [appliedSearch, appliedActive, appliedMinPrice, appliedMaxPrice, appliedMinStock]);

  // Carrega a página atual sempre que filtros, paginação ou tamanho mudam
  const lastReqRef = useRef(0);
  useEffect(() => {
    const reqId = ++lastReqRef.current;
    void fetchAll({
      filters: buildFilters(),
      select: 'id,name,sku,sale_price,stock_quantity,is_active,brand,supplier_id,updated_at',
      orderBy: { column: 'updated_at', ascending: false },
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }).then(() => {
      // ignora resposta de requisições obsoletas (race protection)
      if (reqId !== lastReqRef.current) {
        /* no-op: obsolete request */
      }
    });
  }, [buildFilters, fetchAll, page, pageSize]);

  const handleApplyFilters = useCallback(() => {
    setAppliedSearch(searchInput);
    setAppliedActive(activeInput);
    const min = minPriceInput.trim() === '' ? null : Number(minPriceInput);
    const max = maxPriceInput.trim() === '' ? null : Number(maxPriceInput);
    const stock = minStockInput.trim() === '' ? null : Number(minStockInput);
    setAppliedMinPrice(Number.isFinite(min as number) ? (min as number) : null);
    setAppliedMaxPrice(Number.isFinite(max as number) ? (max as number) : null);
    setAppliedMinStock(Number.isFinite(stock as number) ? (stock as number) : null);
    setPage(1);
  }, [searchInput, activeInput, minPriceInput, maxPriceInput, minStockInput]);

  const handleClearFilters = useCallback(() => {
    setSearchInput('');
    setActiveInput('all');
    setMinPriceInput('');
    setMaxPriceInput('');
    setMinStockInput('');
    setAppliedSearch('');
    setAppliedActive('all');
    setAppliedMinPrice(null);
    setAppliedMaxPrice(null);
    setAppliedMinStock(null);
    setPage(1);
  }, []);

  const hasActiveFilters =
    appliedSearch.length > 0 ||
    appliedActive !== 'all' ||
    appliedMinPrice !== null ||
    appliedMaxPrice !== null ||
    appliedMinStock !== null;

  const products = data as ExternalProduct[];
  const startIdx = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIdx = Math.min((page - 1) * pageSize + products.length, count ?? 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Boxes className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <div>
              <CardTitle className="text-base">Produtos preenchidos (external-db-bridge)</CardTitle>
              <CardDescription className="text-xs">
                Pré-visualização paginada da tabela{' '}
                <code className="rounded bg-muted px-1">products</code> retornada pela edge
                function. Filtros e paginação são aplicados server-side.
              </CardDescription>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              void fetchAll({
                filters: buildFilters(),
                select:
                  'id,name,sku,sale_price,stock_quantity,is_active,brand,supplier_id,updated_at',
                orderBy: { column: 'updated_at', ascending: false },
                limit: pageSize,
                offset: (page - 1) * pageSize,
              });
            }}
            disabled={isLoading}
            aria-label="Recarregar lista de produtos"
          >
            {isLoading ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 h-4 w-4" />
            )}
            Recarregar
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ---- Filtros ---- */}
        <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
          <div className="grid gap-3 md:grid-cols-12">
            <div className="space-y-1.5 md:col-span-5">
              <Label htmlFor="bridge-products-search" className="text-xs">
                Busca (nome, SKU, marca, descrição)
              </Label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="bridge-products-search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleApplyFilters();
                  }}
                  placeholder="Ex: caneca, brinde, ABC123…"
                  className="h-9 pl-7"
                />
              </div>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="bridge-products-active" className="text-xs">
                Status
              </Label>
              <Select value={activeInput} onValueChange={(v) => setActiveInput(v as ActiveFilter)}>
                <SelectTrigger id="bridge-products-active" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Apenas ativos</SelectItem>
                  <SelectItem value="inactive">Apenas inativos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="bridge-products-min-price" className="text-xs">
                Preço mín.
              </Label>
              <Input
                id="bridge-products-min-price"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={minPriceInput}
                onChange={(e) => setMinPriceInput(e.target.value)}
                placeholder="0,00"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="bridge-products-max-price" className="text-xs">
                Preço máx.
              </Label>
              <Input
                id="bridge-products-max-price"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={maxPriceInput}
                onChange={(e) => setMaxPriceInput(e.target.value)}
                placeholder="—"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5 md:col-span-1">
              <Label htmlFor="bridge-products-min-stock" className="text-xs">
                Estoque ≥
              </Label>
              <Input
                id="bridge-products-min-stock"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={minStockInput}
                onChange={(e) => setMinStockInput(e.target.value)}
                placeholder="0"
                className="h-9"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {hasActiveFilters ? (
                <>
                  <Badge variant="secondary" className="text-[10px]">
                    {
                      [
                        appliedSearch && 'busca',
                        appliedActive !== 'all' && 'status',
                        appliedMinPrice !== null && 'preço mín.',
                        appliedMaxPrice !== null && 'preço máx.',
                        appliedMinStock !== null && 'estoque',
                      ].filter(Boolean).length
                    }{' '}
                    filtro(s) ativo(s)
                  </Badge>
                </>
              ) : (
                <span>Sem filtros aplicados</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleClearFilters}
                disabled={!hasActiveFilters && searchInput === '' && activeInput === 'all'}
              >
                <X className="mr-1 h-4 w-4" />
                Limpar
              </Button>
              <Button type="button" size="sm" onClick={handleApplyFilters}>
                <Search className="mr-1 h-4 w-4" />
                Buscar
              </Button>
            </div>
          </div>
        </div>

        {/* ---- Resultados ---- */}
        {error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            Falha ao consultar a edge function: {error}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-lg border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Nome</th>
                  <th className="px-3 py-2 text-left font-medium">SKU</th>
                  <th className="px-3 py-2 text-left font-medium">Marca</th>
                  <th className="px-3 py-2 text-right font-medium">Preço</th>
                  <th className="px-3 py-2 text-right font-medium">Estoque</th>
                  <th className="px-3 py-2 text-center font-medium">Ativo</th>
                  <th className="px-3 py-2 text-left font-medium">Atualizado</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && products.length === 0 ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={`skel-${i}`} className="border-t">
                      <td colSpan={7} className="px-3 py-2">
                        <Skeleton className="h-5 w-full" />
                      </td>
                    </tr>
                  ))
                ) : products.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">
                      Nenhum produto encontrado com os filtros atuais.
                    </td>
                  </tr>
                ) : (
                  products.map((p) => (
                    <tr key={p.id} className="border-t transition-colors hover:bg-muted/30">
                      <td className="max-w-[280px] truncate px-3 py-2" title={p.name}>
                        {p.name || <span className="text-muted-foreground">(sem nome)</span>}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{p.sku ?? '—'}</td>
                      <td className="px-3 py-2 text-xs">{p.brand ?? '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {fmtCurrency(p.sale_price ?? p.unit_price)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{p.stock_qty ?? '—'}</td>
                      <td className="px-3 py-2 text-center">
                        {p.is_active === true ? (
                          <Badge variant="default" className="text-[10px]">
                            Sim
                          </Badge>
                        ) : p.is_active === false ? (
                          <Badge variant="secondary" className="text-[10px]">
                            Não
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {p.updated_at ? new Date(p.updated_at).toLocaleString('pt-BR') : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ---- Paginação ---- */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs tabular-nums text-muted-foreground">
            {isLoading && products.length === 0
              ? 'Carregando…'
              : count !== null && count !== undefined
                ? `${startIdx}–${endIdx} de ${count.toLocaleString('pt-BR')} produto(s)`
                : `${products.length} produto(s) carregado(s)`}
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="bridge-products-page-size" className="text-xs">
              Por página
            </Label>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                setPageSize(Number(v) as PageSize);
                setPage(1);
              }}
            >
              <SelectTrigger id="bridge-products-page-size" className="h-8 w-[80px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="ml-2 flex items-center gap-1">
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-8 w-8"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={isLoading || page <= 1}
                aria-label="Página anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[80px] px-2 text-center text-xs tabular-nums">
                {page} / {totalPages}
              </span>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-8 w-8"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={isLoading || page >= totalPages}
                aria-label="Próxima página"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
