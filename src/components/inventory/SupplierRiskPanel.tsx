/**
 * SupplierRiskPanel — Orchestrator for supplier risk dashboard.
 * v4: Refactored into smaller components (SRP compliance).
 * Sub-components: risk/ProductRiskDetail, risk/RiskKpi, risk/RiskTooltip, risk/types
 */
import { useMemo, useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  Package,
  Clock,
  Search,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type ProductStockSummary } from "@/types/stock";
import { ProductRiskDetail } from "./risk/ProductRiskDetail";
import { deriveSeverity, SEVERITY_ORDER, type RiskProduct, type RiskSeverity } from "./risk/types";

// ---------- Main Panel ----------

interface SupplierRiskPanelProps {
  products: ProductStockSummary[];
}

export function SupplierRiskPanel({ products }: SupplierRiskPanelProps) {
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<RiskSeverity | 'all'>('all');
  const listParentRef = useRef<HTMLDivElement>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Derive risk products
  const riskProducts = useMemo<RiskProduct[]>(() => {
    return products
      .map(p => ({
        id: p.productId,
        name: p.productName,
        sku: p.productSku,
        currentStock: p.totalCurrentStock,
        minStock: p.totalMinStock,
        severity: deriveSeverity(p),
        status: p.overallStatus,
        variantsCritical: p.variantsCritical,
        variantsOutOfStock: p.variantsOutOfStock,
        totalVariants: p.totalVariants,
      }))
      .sort((a, b) => {
        const severityDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
        if (severityDiff !== 0) return severityDiff;
        return a.currentStock - b.currentStock;
      });
  }, [products]);

  // Global counts (for filter buttons — unaffected by search/filter)
  const globalCounts = useMemo(() => {
    let critical = 0, warning = 0, ok = 0;
    for (const p of riskProducts) {
      if (p.severity === 'critical') critical++;
      else if (p.severity === 'warning') warning++;
      else ok++;
    }
    return { critical, warning, ok };
  }, [riskProducts]);

  // Filter
  const filteredProducts = useMemo(() => {
    let result = riskProducts;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
    }
    if (severityFilter !== 'all') {
      result = result.filter(p => p.severity === severityFilter);
    }
    return result;
  }, [riskProducts, debouncedSearch, severityFilter]);

  // P5 fix: single-loop filtered counts
  const filteredCounts = useMemo(() => {
    let critical = 0, warning = 0, ok = 0;
    for (const p of filteredProducts) {
      if (p.severity === 'critical') critical++;
      else if (p.severity === 'warning') warning++;
      else ok++;
    }
    return { critical, warning, ok, total: filteredProducts.length };
  }, [filteredProducts]);

  // B7 fix: use callback setter to avoid re-render loop
  useEffect(() => {
    if (filteredProducts.length === 0) {
      setSelectedProductId(prev => prev === null ? prev : null);
      return;
    }
    setSelectedProductId(prev => {
      if (prev && filteredProducts.some(p => p.id === prev)) return prev;
      return filteredProducts[0].id;
    });
  }, [filteredProducts]);

  // Virtual list
  const virtualizer = useVirtualizer({
    count: filteredProducts.length,
    getScrollElement: () => listParentRef.current,
    estimateSize: () => 52,
    overscan: 10,
  });

  // B11 fix: safe lastUpdated with proper undefined handling
  const lastUpdated = useMemo(() => {
    if (!products.length) return null;
    let latest = '';
    for (const p of products) {
      for (const v of p.variants) {
        if (v.updatedAt && v.updatedAt > latest) {
          latest = v.updatedAt;
        }
      }
    }
    if (!latest) return null;
    try {
      return format(new Date(latest), 'dd/MM HH:mm', { locale: ptBR });
    } catch {
      return null;
    }
  }, [products]);

  const selected = filteredProducts.find(p => p.id === selectedProductId) ?? null;

  // Empty state
  if (!products.length) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-warning/10 flex items-center justify-center">
              <ShieldAlert className="h-4 w-4 text-warning" aria-hidden="true" />
            </div>
            Risco de Ruptura no Fornecedor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
            <div className="h-14 w-14 rounded-full bg-muted/50 flex items-center justify-center">
              <Package className="h-7 w-7 text-muted-foreground/40" />
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">Sem dados disponíveis</p>
              <p className="text-sm text-muted-foreground max-w-xs">
                Carregue os dados de estoque para visualizar a análise de risco por fornecedor.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-warning/10 flex items-center justify-center">
                <ShieldAlert className="h-4 w-4 text-warning" aria-hidden="true" />
              </div>
              Risco de Ruptura no Fornecedor
              {globalCounts.critical > 0 && (
                <Badge variant="destructive" className="text-[10px] animate-pulse">
                  {globalCounts.critical} crítico{globalCounts.critical > 1 ? 's' : ''}
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="mt-1">
              Monitore produtos com risco de acabar no fornecedor — antecipe compras e evite perder vendas
            </CardDescription>
          </div>
          {lastUpdated && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1" aria-label={`Última atualização: ${lastUpdated}`}>
              <Clock className="h-3 w-3" aria-hidden="true" />
              {lastUpdated}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
          {/* Product list */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              <Input
                placeholder="Buscar produto ou SKU..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-8 h-8 text-xs"
                aria-label="Buscar produto no painel de risco"
              />
            </div>

            {/* Severity filter buttons */}
            <div className="flex gap-1 flex-wrap" role="radiogroup" aria-label="Filtrar por severidade">
              {([
                { value: 'all' as const, label: 'Todos', count: riskProducts.length },
                { value: 'critical' as const, label: 'Críticos', count: globalCounts.critical },
                { value: 'warning' as const, label: 'Atenção', count: globalCounts.warning },
                { value: 'ok' as const, label: 'OK', count: globalCounts.ok },
              ]).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setSeverityFilter(opt.value)}
                  className={cn(
                    "text-[9px] px-2 py-0.5 rounded-full transition-colors",
                    severityFilter === opt.value
                      ? opt.value === 'critical' ? 'bg-destructive/15 text-destructive'
                        : opt.value === 'warning' ? 'bg-warning/15 text-warning'
                        : opt.value === 'ok' ? 'bg-primary/15 text-primary'
                        : 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:bg-muted/50'
                  )}
                  aria-checked={severityFilter === opt.value}
                  role="radio"
                >
                  {opt.label} ({opt.count})
                </button>
              ))}
            </div>

            {/* Virtualized list */}
            <div
              ref={listParentRef}
              className="h-[250px] sm:h-[300px] overflow-auto"
              role="listbox"
              aria-label="Lista de produtos com risco"
            >
              {filteredProducts.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  {debouncedSearch ? 'Nenhum produto encontrado' : 'Nenhum produto nesta categoria'}
                </p>
              ) : (
                <div style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
                  {virtualizer.getVirtualItems().map(virtualRow => {
                    const product = filteredProducts[virtualRow.index];
                    return (
                      <div
                        key={product.id}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <button
                          onClick={() => setSelectedProductId(product.id)}
                          role="option"
                          aria-selected={selectedProductId === product.id}
                          className={cn(
                            "w-full text-left p-2 rounded-lg text-xs transition-colors",
                            selectedProductId === product.id
                              ? "bg-primary/10 border border-primary/20"
                              : "hover:bg-muted/50"
                          )}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <div className="min-w-0 flex-1">
                              <span className="font-medium truncate block">{product.name}</span>
                              <span className="text-[9px] text-muted-foreground">{product.sku}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[9px] text-muted-foreground">{product.currentStock} un</span>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[9px] px-1.5 py-0",
                                  product.severity === 'critical' ? 'bg-destructive/15 text-destructive border-destructive/30' :
                                  product.severity === 'warning' ? 'bg-warning/15 text-warning border-warning/30' :
                                  'bg-primary/10 text-primary border-primary/20'
                                )}
                              >
                                {product.severity === 'critical' && <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />}
                                {product.severity === 'critical' ? 'Crítico' :
                                 product.severity === 'warning' ? 'Atenção' : 'OK'}
                              </Badge>
                            </div>
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Summary — reflects filtered products */}
            <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-border">
              <div className="text-center p-1.5 rounded bg-destructive/10" role="status" aria-label={`${filteredCounts.critical} produtos críticos`}>
                <p className="text-lg font-bold text-destructive">{filteredCounts.critical}</p>
                <p className="text-[9px] text-destructive">Críticos</p>
              </div>
              <div className="text-center p-1.5 rounded bg-warning/10" role="status" aria-label={`${filteredCounts.warning} produtos em atenção`}>
                <p className="text-lg font-bold text-warning">{filteredCounts.warning}</p>
                <p className="text-[9px] text-warning">Atenção</p>
              </div>
              <div className="text-center p-1.5 rounded bg-primary/10" role="status" aria-label={`${filteredCounts.ok} produtos OK`}>
                <p className="text-lg font-bold text-primary">{filteredCounts.ok}</p>
                <p className="text-[9px] text-primary">OK</p>
              </div>
            </div>
          </div>

          {/* Detail panel */}
          <div className="border-t lg:border-t-0 lg:border-l border-border pt-4 lg:pt-0 lg:pl-4">
            {selected ? (
              <ProductRiskDetail
                productId={selected.id}
                productName={selected.name}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground py-8">
                Selecione um produto para ver os detalhes de risco
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
