/**
 * CompareTableView — Tabela detalhada de comparação (10/10).
 * Sticky thumbnails ao rolar, hover swatch troca foto, AnimatePresence em colunas,
 * sparkline 30d, badge risco estoque, linha "outros fornecedores".
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { X, Check, Minus, Crown, AlertTriangle } from 'lucide-react';
import { m as motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useComparisonHighlight, highlightClasses } from './ComparisonHighlights';
import { PriceSparkline } from './PriceSparkline';
import { StockRiskBadge } from './StockRiskBadge';
import { OtherSuppliersRow } from './OtherSuppliersRow';
import type { CompareVariantInfo } from '@/stores/useComparisonStore';
// Runtime/UI Product (from useProducts) — distinct from src/types/product.ts (DB-oriented).
import type { Product } from '@/types/product-catalog';
import { leadTimeProxy, leadTimeLabel } from '@/lib/comparison-utils';

export interface CompareEntry {
  product: Product;
  variant?: CompareVariantInfo;
  index: number;
}

interface CompareTableViewProps {
  entries: CompareEntry[];
  products: Product[];
  formatCurrency: (v: number) => string;
  getStockStatusLabel: (s: string) => { label: string; color: string };
  onRemove: (index: number) => void;
  differencesOnly?: boolean;
}

function allEqual<T>(arr: T[]): boolean {
  if (arr.length < 2) return true;
  const first = JSON.stringify(arr[0]);
  return arr.every((v) => JSON.stringify(v) === first);
}

export function CompareTableView({
  entries,
  products,
  formatCurrency,
  getStockStatusLabel,
  onRemove,
  differencesOnly = false,
}: CompareTableViewProps) {
  const navigate = useNavigate();
  const headerSentinelRef = useRef<HTMLDivElement | null>(null);
  const [headerStuck, setHeaderStuck] = useState(false);
  const [hoveredVariant, setHoveredVariant] = useState<Record<number, string | null>>({});

  // Sticky thumbnails: IntersectionObserver on top of table
  useEffect(() => {
    const el = headerSentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setHeaderStuck(!entry.isIntersecting), {
      threshold: 0,
      rootMargin: '0px',
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const eq = {
    sku: allEqual(products.map((p) => p.sku)),
    category: allEqual(products.map((p) => p.category?.name)),
    supplier: allEqual(products.map((p) => p.supplier?.name)),
    isKit: allEqual(products.map((p) => p.isKit)),
    materials: allEqual(products.map((p) => (p.materials ?? []).slice().sort().join('|'))),
    publico: allEqual(products.map((p) => (p.tags?.publicoAlvo ?? []).slice().sort().join('|'))),
    datas: allEqual(
      products.map((p) => (p.tags?.datasComemorativas ?? []).slice().sort().join('|')),
    ),
    description: allEqual(products.map((p) => p.description ?? '')),
    weight: allEqual(products.map((p) => p.dimensions?.weight_g ?? null)),
    dims: allEqual(
      products.map(
        (p) =>
          `${p.dimensions?.height_cm ?? ''}x${p.dimensions?.width_cm ?? ''}x${p.dimensions?.length_cm ?? ''}`,
      ),
    ),
  };

  const showRow = (key: keyof typeof eq) => !differencesOnly || !eq[key];

  return (
    <div className="relative">
      {/* Sentinel for sticky observation */}
      <div ref={headerSentinelRef} aria-hidden className="h-px" />

      {/* Sticky mini-header */}
      <AnimatePresence>
        {headerStuck && (
          <motion.div
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            className="sticky top-0 z-30 border-b border-border bg-background/95 px-2 py-2 shadow-sm backdrop-blur-md"
          >
            <div className="flex items-center gap-2 overflow-x-auto">
              {entries.map((entry) => (
                <div
                  key={`sticky-${entry.index}`}
                  className="flex min-w-[180px] shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-2 py-1"
                >
                  <img
                    src={hoveredVariant[entry.index] ?? entry.product.images[0]}
                    alt={entry.product.name}
                    className="h-8 w-8 rounded object-cover"
                    loading="lazy"
                  />
                  <span className="line-clamp-1 flex-1 text-xs font-medium">
                    {entry.product.name}
                  </span>
                  <span className="text-xs font-bold tabular-nums text-primary">
                    {formatCurrency(entry.product.price)}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ScrollArea className="w-full">
        <div className="min-w-[800px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-10 w-[200px] bg-muted/50">Atributo</TableHead>
                <AnimatePresence mode="popLayout" initial={false}>
                  {entries.map((entry) => (
                    <motion.th
                      key={`th-${entry.index}-${entry.product.id}`}
                      layout
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, x: 30, scale: 0.9 }}
                      transition={{ duration: 0.25 }}
                      className="h-12 min-w-[200px] px-4 text-center align-middle text-sm font-medium text-muted-foreground"
                    >
                      <div className="group relative" data-compare-product={entry.index}>
                        <button
                          aria-label="Remover da comparação"
                          onClick={() => onRemove(entry.index)}
                          className="absolute -right-1 -top-1 z-10 rounded-full border border-border bg-background p-1 opacity-0 transition-opacity hover:bg-destructive/20 group-hover:opacity-100"
                        >
                          <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                        </button>
                        <div className="flex flex-col items-center gap-2">
                          <img
                            src={hoveredVariant[entry.index] ?? entry.product.images[0]}
                            alt={entry.product.name}
                            className="h-24 w-24 cursor-pointer rounded-lg object-cover transition-all hover:ring-2 hover:ring-primary"
                            onClick={() => navigate(`/produto/${entry.product.id}`)}
                            loading="lazy"
                          />
                          <span className="line-clamp-2 text-sm font-medium text-foreground">
                            {entry.product.name}
                          </span>
                          {entry.variant?.color_name && (
                            <Badge variant="secondary" className="gap-1 px-1.5 py-0.5 text-[10px]">
                              {entry.variant.color_hex && (
                                <span
                                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-border/50"
                                  style={{ backgroundColor: entry.variant.color_hex }}
                                />
                              )}
                              {entry.variant.color_name}
                            </Badge>
                          )}
                          {/* Hover swatches → swap header image */}
                          {(entry.product.colors?.length ?? 0) > 1 && (
                            <div className="flex flex-wrap justify-center gap-0.5">
                              {entry.product.colors.map(
                                (c: { name: string; hex?: string }, i: number) => (
                                  <button
                                    key={i}
                                    type="button"
                                    className="h-3.5 w-3.5 rounded-full border border-border transition-transform hover:scale-125"
                                    style={{ backgroundColor: c.hex }}
                                    title={c.name}
                                    onMouseEnter={() => {
                                      const altImg =
                                        entry.product.images[i] ?? entry.product.images[0] ?? null;
                                      setHoveredVariant((prev) => ({
                                        ...prev,
                                        [entry.index]: altImg,
                                      }));
                                    }}
                                    onMouseLeave={() =>
                                      setHoveredVariant((prev) => ({
                                        ...prev,
                                        [entry.index]: null,
                                      }))
                                    }
                                  />
                                ),
                              )}
                            </div>
                          )}
                          <StockRiskBadge product={entry.product} />
                        </div>
                      </div>
                    </motion.th>
                  ))}
                </AnimatePresence>
              </TableRow>
            </TableHeader>
            <TableBody>
              <HighlightedNumberRow
                label="Preço unitário"
                products={products}
                valueFn={(p) => p.price}
                renderFn={(v) => formatCurrency(v)}
                mode="lower-is-better"
              />

              {/* Price trend row (sparkline 30d) */}
              <TableRow>
                <TableCell className="sticky left-0 bg-muted/50 font-medium">
                  <div>Tendência (30d)</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    SPARKLINE
                  </div>
                </TableCell>
                {products.map((p, idx) => (
                  <TableCell key={`spark-${idx}`} className="text-center">
                    <PriceSparkline productId={p.id} />
                  </TableCell>
                ))}
              </TableRow>

              <HighlightedNumberRow
                label="Quantidade mínima"
                products={products}
                valueFn={(p) => p.minQuantity}
                renderFn={(v) => `${v} un.`}
                mode="lower-is-better"
              />
              <HighlightedNumberRow
                label="Custo total (qtd. mín.)"
                products={products}
                valueFn={(p) => Number(p.price ?? 0) * Number(p.minQuantity ?? 1)}
                renderFn={(v) => formatCurrency(v)}
                mode="lower-is-better"
                subtitle="TCO"
              />
              <HighlightedNumberRow
                label="Estoque"
                products={products}
                valueFn={(p) => p.stock ?? 0}
                renderFn={(v) => `${v.toLocaleString('pt-BR')} un.`}
                mode="higher-is-better"
              />
              <HighlightedNumberRow
                label="Lead time"
                products={products}
                valueFn={(p) => leadTimeProxy(p.stockStatus)}
                renderFn={(v) =>
                  leadTimeLabel(v === 1 ? 'in-stock' : v === 2 ? 'low-stock' : 'out-of-stock')
                }
                mode="lower-is-better"
              />
              <HighlightedNumberRow
                label="Variedade de cores"
                products={products}
                valueFn={(p) => p.colors?.length ?? 0}
                renderFn={(v) => `${v} cores`}
                mode="higher-is-better"
              />

              {showRow('sku') && (
                <SimpleRow
                  label="SKU"
                  products={products}
                  render={(p) => <span className="font-mono text-sm">{p.sku}</span>}
                />
              )}
              {showRow('category') && (
                <SimpleRow
                  label="Categoria"
                  products={products}
                  render={(p) => <Badge variant="outline">{p.category?.name}</Badge>}
                />
              )}
              {showRow('supplier') && (
                <SimpleRow
                  label="Fornecedor"
                  products={products}
                  render={(p) => (
                    <div className="flex items-center justify-center gap-1.5">
                      <span>{p.supplier?.name}</span>
                    </div>
                  )}
                />
              )}
              <SimpleRow
                label="Estoque (status)"
                products={products}
                render={(p) => {
                  const s = getStockStatusLabel(p.stockStatus);
                  return <span className={cn('font-medium', s.color)}>{s.label}</span>;
                }}
              />
              {showRow('isKit') && (
                <SimpleRow
                  label="É Kit?"
                  products={products}
                  render={(p) =>
                    p.isKit ? (
                      <Check className="mx-auto h-5 w-5 text-success" />
                    ) : (
                      <Minus className="mx-auto h-5 w-5 text-muted-foreground" />
                    )
                  }
                />
              )}
              <SimpleRow
                label="Cores disponíveis"
                products={products}
                render={(p) => (
                  <div
                    className="flex flex-wrap justify-center gap-1"
                    aria-label={`${p.colors?.length ?? 0} cores`}
                    data-testid="compare-colors-cell"
                    data-colors-count={p.colors?.length ?? 0}
                  >
                    {p.colors?.map((c: { name: string; hex?: string }, i: number) => (
                      <div
                        key={i}
                        className="h-5 w-5 rounded-full border border-border"
                        style={{ backgroundColor: c.hex }}
                        title={c.name}
                        data-testid="compare-color-dot"
                      />
                    ))}
                  </div>
                )}
              />
              {showRow('materials') && (
                <SimpleRow
                  label="Materiais"
                  products={products}
                  render={(p) => (
                    <div className="flex flex-wrap justify-center gap-1">
                      {(p.materials ?? []).map((m: string) => (
                        <Badge key={m} variant="secondary" className="text-xs">
                          {m}
                        </Badge>
                      ))}
                    </div>
                  )}
                />
              )}
              {showRow('weight') && (
                <SimpleRow
                  label="Peso"
                  products={products}
                  render={(p) =>
                    p.dimensions?.weight_g ? (
                      <span>{p.dimensions.weight_g} g</span>
                    ) : (
                      <Minus className="mx-auto h-4 w-4 text-muted-foreground" />
                    )
                  }
                />
              )}
              {showRow('dims') && (
                <SimpleRow
                  label="Dimensões"
                  products={products}
                  render={(p) => {
                    const d = p.dimensions;
                    if (!d) return <Minus className="mx-auto h-4 w-4 text-muted-foreground" />;
                    const parts = [d.height_cm, d.width_cm, d.length_cm].filter(Boolean);
                    return parts.length ? (
                      <span className="text-xs">{parts.join(' × ')} cm</span>
                    ) : (
                      <Minus className="mx-auto h-4 w-4 text-muted-foreground" />
                    );
                  }}
                />
              )}
              {showRow('publico') && (
                <SimpleRow
                  label="Público-alvo"
                  products={products}
                  render={(p) => (
                    <div className="flex flex-wrap justify-center gap-1">
                      {(p.tags?.publicoAlvo ?? []).slice(0, 3).map((t: string) => (
                        <Badge key={t} variant="outline" className="text-xs">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  )}
                />
              )}
              {showRow('datas') && (
                <SimpleRow
                  label="Datas comemorativas"
                  products={products}
                  render={(p) =>
                    (p.tags?.datasComemorativas ?? []).length > 0 ? (
                      <div className="flex flex-wrap justify-center gap-1">
                        {p.tags.datasComemorativas.slice(0, 2).map((d: string) => (
                          <Badge key={d} variant="outline" className="text-xs">
                            {d}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <Minus className="mx-auto h-4 w-4 text-muted-foreground" />
                    )
                  }
                />
              )}
              {showRow('description') && (
                <SimpleRow
                  label="Descrição"
                  products={products}
                  render={(p) => (
                    <p className="line-clamp-3 text-sm text-muted-foreground">{p.description}</p>
                  )}
                />
              )}

              {/* Other suppliers — expandable */}
              <TableRow>
                <TableCell className="sticky left-0 bg-muted/50 font-medium">
                  Alternativas
                </TableCell>
                {products.map((p, idx) => (
                  <TableCell key={`alt-${idx}`} className="align-top">
                    <OtherSuppliersRow product={p} formatCurrency={formatCurrency} />
                  </TableCell>
                ))}
              </TableRow>

              <SimpleRow
                label="Ações"
                products={products}
                render={(p) => (
                  <Button size="sm" onClick={() => navigate(`/produto/${p.id}`)}>
                    Ver Detalhes
                  </Button>
                )}
              />
            </TableBody>
          </Table>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}

function SimpleRow({
  label,
  products,
  render,
}: {
  label: string;
  products: Product[];
  render: (p: Product) => React.ReactNode;
}) {
  return (
    <TableRow>
      <TableCell className="sticky left-0 bg-muted/50 font-medium">{label}</TableCell>
      {products.map((p, idx) => (
        <TableCell key={`cell-${idx}`} className="text-center">
          {render(p)}
        </TableCell>
      ))}
    </TableRow>
  );
}

function HighlightedNumberRow({
  label,
  products,
  valueFn,
  renderFn,
  mode,
  subtitle,
}: {
  label: string;
  products: Product[];
  valueFn: (p: Product) => number;
  renderFn: (v: number) => string;
  mode: 'higher-is-better' | 'lower-is-better';
  subtitle?: string;
}) {
  const values = products.map(valueFn);
  const highlights = useComparisonHighlight(values, mode);
  return (
    <TableRow>
      <TableCell className="sticky left-0 bg-muted/50 font-medium">
        <div>
          <div>{label}</div>
          {subtitle && (
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {subtitle}
            </div>
          )}
        </div>
      </TableCell>
      {products.map((_, idx) => (
        <TableCell
          key={`cell-${idx}`}
          className={cn('text-center', highlightClasses[highlights[idx]])}
        >
          <div className="flex items-center justify-center gap-1">
            {highlights[idx] === 'best' && <Crown className="h-3.5 w-3.5 text-success" />}
            <span
              className={cn(
                highlights[idx] === 'best'
                  ? 'font-semibold text-success'
                  : highlights[idx] === 'worst'
                    ? 'text-destructive'
                    : '',
              )}
            >
              {renderFn(values[idx])}
            </span>
            {highlights[idx] === 'worst' && <AlertTriangle className="h-3 w-3 text-destructive" />}
          </div>
        </TableCell>
      ))}
    </TableRow>
  );
}
