/**
 * CompareTableView — Tabela detalhada de comparação (10/10).
 * Sticky thumbnails ao rolar, hover swatch troca foto, AnimatePresence em colunas,
 * sparkline 30d, badge risco estoque, linha "outros fornecedores".
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { X, Check, Minus, Crown, AlertTriangle, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useComparisonHighlight, highlightClasses } from "./ComparisonHighlights";
import { PriceSparkline } from "./PriceSparkline";
import { StockRiskBadge } from "./StockRiskBadge";
import { OtherSuppliersRow } from "./OtherSuppliersRow";
import type { CompareVariantInfo } from "@/stores/useComparisonStore";
import type { Product } from "@/types/product";

interface CompareEntry {
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

function leadTimeProxy(status: string | undefined): number {
  switch (status) {
    case "in-stock": return 1;
    case "low-stock": return 2;
    case "out-of-stock": return 4;
    default: return 2;
  }
}

function leadTimeLabel(status: string | undefined): string {
  switch (status) {
    case "in-stock": return "1-3 dias";
    case "low-stock": return "5-10 dias";
    case "out-of-stock": return "Sob consulta";
    default: return "—";
  }
}

function allEqual<T>(arr: T[]): boolean {
  if (arr.length < 2) return true;
  const first = JSON.stringify(arr[0]);
  return arr.every(v => JSON.stringify(v) === first);
}

/** Lê com segurança um array de strings de um campo do JSONB `tags`. */
function tagArray(tags: Product["tags"], key: string): string[] {
  const v = tags?.[key];
  return Array.isArray(v) ? (v as string[]) : [];
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
    const observer = new IntersectionObserver(
      ([entry]) => setHeaderStuck(!entry.isIntersecting),
      { threshold: 0, rootMargin: "0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const eq = {
    sku: allEqual(products.map(p => p.sku)),
    category: allEqual(products.map(p => p.category?.name)),
    supplier: allEqual(products.map(p => p.supplier?.name)),
    isKit: allEqual(products.map(p => p.is_kit)),
    materials: allEqual(products.map(p => (p.materials ?? []).slice().sort().join("|"))),
    publico: allEqual(products.map(p => tagArray(p.tags, "publicoAlvo").slice().sort().join("|"))),
    datas: allEqual(products.map(p => tagArray(p.tags, "datasComemorativas").slice().sort().join("|"))),
    description: allEqual(products.map(p => p.description ?? "")),
    weight: allEqual(products.map(p => p.dimensions?.weight_g ?? null)),
    dims: allEqual(products.map(p => `${p.dimensions?.height_cm ?? ""}x${p.dimensions?.width_cm ?? ""}x${p.dimensions?.length_cm ?? ""}`)),
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
            className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border py-2 px-2 shadow-sm"
          >
            <div className="flex items-center gap-2 overflow-x-auto">
              {entries.map((entry) => (
                <div
                  key={`sticky-${entry.index}`}
                  className="flex items-center gap-2 px-2 py-1 rounded-lg bg-card border border-border shrink-0 min-w-[180px]"
                >
                  <img
                    src={hoveredVariant[entry.index] ?? entry.product.images?.[0]}
                    alt={entry.product.name}
                    className="w-8 h-8 rounded object-cover"
                    loading="lazy"
                  />
                  <span className="text-xs font-medium line-clamp-1 flex-1">{entry.product.name}</span>
                  <span className="text-xs font-bold text-primary tabular-nums">{formatCurrency(entry.product.price)}</span>
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
                <TableHead className="w-[200px] bg-muted/50 sticky left-0 z-10">Atributo</TableHead>
                <AnimatePresence mode="popLayout" initial={false}>
                  {entries.map((entry) => (
                    <motion.th
                      key={`th-${entry.index}-${entry.product.id}`}
                      layout
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, x: 30, scale: 0.9 }}
                      transition={{ duration: 0.25 }}
                      className="min-w-[200px] text-center align-middle h-12 px-4 text-muted-foreground font-medium text-sm"
                    >
                      <div className="relative group" data-compare-product={entry.index}>
                        <button aria-label="Remover da comparação" onClick={() => onRemove(entry.index)}
                          className="absolute -top-1 -right-1 p-1 rounded-full bg-background border border-border opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20 z-10">
                          <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                        </button>
                        <div className="flex flex-col items-center gap-2">
                          <img
                            src={hoveredVariant[entry.index] ?? entry.product.images?.[0]}
                            alt={entry.product.name}
                            className="w-24 h-24 rounded-lg object-cover cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                            onClick={() => navigate(`/produto/${entry.product.id}`)}
                            loading="lazy"
                          />
                          <span className="font-medium text-foreground text-sm line-clamp-2">{entry.product.name}</span>
                          {entry.variant?.color_name && (
                            <Badge variant="secondary" className="text-[10px] gap-1 px-1.5 py-0.5">
                              {entry.variant.color_hex && <span className="inline-block w-2.5 h-2.5 rounded-full border border-border/50 shrink-0" style={{ backgroundColor: entry.variant.color_hex }} />}
                              {entry.variant.color_name}
                            </Badge>
                          )}
                          {/* Hover swatches → swap header image */}
                          {(entry.product.colors?.length ?? 0) > 1 && (
                            <div className="flex gap-0.5 flex-wrap justify-center">
                              {(entry.product.colors ?? []).slice(0, 6).map((c: { name: string; hex?: string }, i: number) => (
                                <button
                                  key={i}
                                  type="button"
                                  className="w-3.5 h-3.5 rounded-full border border-border hover:scale-125 transition-transform"
                                  style={{ backgroundColor: c.hex }}
                                  title={c.name}
                                  onMouseEnter={() => {
                                    const altImg = entry.product.images?.[i] ?? entry.product.images?.[0] ?? null;
                                    setHoveredVariant(prev => ({ ...prev, [entry.index]: altImg }));
                                  }}
                                  onMouseLeave={() => setHoveredVariant(prev => ({ ...prev, [entry.index]: null }))}
                                />
                              ))}
                            </div>
                          )}
                          <StockRiskBadge product={entry.product as unknown as Record<string, unknown>} />
                        </div>
                      </div>
                    </motion.th>
                  ))}
                </AnimatePresence>
              </TableRow>
            </TableHeader>
            <TableBody>
              <HighlightedNumberRow label="Preço unitário" products={products} valueFn={(p) => p.price} renderFn={(v) => formatCurrency(v)} mode="lower-is-better" />

              {/* Price trend row (sparkline 30d) */}
              <TableRow>
                <TableCell className="font-medium bg-muted/50 sticky left-0">
                  <div>Tendência (30d)</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">SPARKLINE</div>
                </TableCell>
                {products.map((p, idx) => (
                  <TableCell key={`spark-${idx}`} className="text-center">
                    <PriceSparkline productId={p.id} />
                  </TableCell>
                ))}
              </TableRow>

              <HighlightedNumberRow label="Quantidade mínima" products={products} valueFn={(p) => p.min_quantity ?? 0} renderFn={(v) => `${v} un.`} mode="lower-is-better" />
              <HighlightedNumberRow label="Custo total (qtd. mín.)" products={products} valueFn={(p) => Number(p.price ?? 0) * Number(p.min_quantity ?? 1)} renderFn={(v) => formatCurrency(v)} mode="lower-is-better" subtitle="TCO" />
              <HighlightedNumberRow label="Estoque" products={products} valueFn={(p) => p.stock ?? 0} renderFn={(v) => `${v.toLocaleString("pt-BR")} un.`} mode="higher-is-better" />
              <HighlightedNumberRow label="Lead time" products={products} valueFn={(p) => leadTimeProxy(p.stock_status ?? undefined)} renderFn={(v) => leadTimeLabel(v === 1 ? "in-stock" : v === 2 ? "low-stock" : "out-of-stock")} mode="lower-is-better" />
              <HighlightedNumberRow label="Variedade de cores" products={products} valueFn={(p) => (p.colors?.length ?? 0)} renderFn={(v) => `${v} cores`} mode="higher-is-better" />

              {showRow("sku") && <SimpleRow label="SKU" products={products} render={(p) => <span className="font-mono text-sm">{p.sku}</span>} />}
              {showRow("category") && <SimpleRow label="Categoria" products={products} render={(p) => <Badge variant="outline">{p.category?.icon} {p.category?.name}</Badge>} />}
              {showRow("supplier") && (
                <SimpleRow label="Fornecedor" products={products} render={(p) => (
                  <div className="flex items-center justify-center gap-1.5">
                    {p.supplier?.verified && <ShieldCheck className="h-3.5 w-3.5 text-success" />}
                    <span>{p.supplier?.name}</span>
                  </div>
                )} />
              )}
              <SimpleRow label="Estoque (status)" products={products} render={(p) => {
                const s = getStockStatusLabel(p.stock_status ?? "");
                return (<span className={cn("font-medium", s.color)}>{s.label}</span>);
              }} />
              {showRow("isKit") && <SimpleRow label="É Kit?" products={products} render={(p) => p.is_kit ? <Check className="h-5 w-5 text-success mx-auto" /> : <Minus className="h-5 w-5 text-muted-foreground mx-auto" />} />}
              <SimpleRow label="Cores disponíveis" products={products} render={(p) => (
                <div className="flex flex-wrap justify-center gap-1">
                  {(p.colors ?? []).slice(0, 6).map((c: { name: string; hex?: string }, i: number) => <div key={i} className="w-5 h-5 rounded-full border border-border" style={{ backgroundColor: c.hex }} title={c.name} />)}
                  {(p.colors?.length ?? 0) > 6 && <span className="text-xs text-muted-foreground">+{(p.colors?.length ?? 0) - 6}</span>}
                </div>
              )} />
              {showRow("materials") && (
                <SimpleRow label="Materiais" products={products} render={(p) => (
                  <div className="flex flex-wrap justify-center gap-1">
                    {(p.materials ?? []).map((m: string) => <Badge key={m} variant="secondary" className="text-xs">{m}</Badge>)}
                  </div>
                )} />
              )}
              {showRow("weight") && <SimpleRow label="Peso" products={products} render={(p) => p.dimensions?.weight_g ? <span>{p.dimensions.weight_g} g</span> : <Minus className="h-4 w-4 text-muted-foreground mx-auto" />} />}
              {showRow("dims") && (
                <SimpleRow label="Dimensões" products={products} render={(p) => {
                  const d = p.dimensions;
                  if (!d) return <Minus className="h-4 w-4 text-muted-foreground mx-auto" />;
                  const parts = [d.height_cm, d.width_cm, d.length_cm].filter(Boolean);
                  return parts.length ? <span className="text-xs">{parts.join(" × ")} cm</span> : <Minus className="h-4 w-4 text-muted-foreground mx-auto" />;
                }} />
              )}
              {showRow("publico") && (
                <SimpleRow label="Público-alvo" products={products} render={(p) => (
                  <div className="flex flex-wrap justify-center gap-1">
                    {tagArray(p.tags, "publicoAlvo").slice(0, 3).map((t: string) => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}
                  </div>
                )} />
              )}
              {showRow("datas") && (
                <SimpleRow label="Datas comemorativas" products={products} render={(p) => {
                  const datas = tagArray(p.tags, "datasComemorativas");
                  return datas.length > 0
                    ? <div className="flex flex-wrap justify-center gap-1">{datas.slice(0, 2).map((d: string) => <Badge key={d} variant="outline" className="text-xs">{d}</Badge>)}</div>
                    : <Minus className="h-4 w-4 text-muted-foreground mx-auto" />;
                }} />
              )}
              {showRow("description") && <SimpleRow label="Descrição" products={products} render={(p) => <p className="text-sm text-muted-foreground line-clamp-3">{p.description}</p>} />}

              {/* Other suppliers — expandable */}
              <TableRow>
                <TableCell className="font-medium bg-muted/50 sticky left-0">Alternativas</TableCell>
                {products.map((p, idx) => (
                  <TableCell key={`alt-${idx}`} className="align-top">
                    <OtherSuppliersRow product={p as unknown as Record<string, unknown>} formatCurrency={formatCurrency} />
                  </TableCell>
                ))}
              </TableRow>

              <SimpleRow label="Ações" products={products} render={(p) => <Button size="sm" onClick={() => navigate(`/produto/${p.id}`)}>Ver Detalhes</Button>} />
            </TableBody>
          </Table>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}

function SimpleRow({ label, products, render }: { label: string; products: Product[]; render: (p: Product) => React.ReactNode }) {
  return (
    <TableRow>
      <TableCell className="font-medium bg-muted/50 sticky left-0">{label}</TableCell>
      {products.map((p, idx) => <TableCell key={`cell-${idx}`} className="text-center">{render(p)}</TableCell>)}
    </TableRow>
  );
}

function HighlightedNumberRow({
  label, products, valueFn, renderFn, mode, subtitle,
}: {
  label: string;
  products: Product[];
  valueFn: (p: Product) => number;
  renderFn: (v: number) => string;
  mode: "lower-is-better" | "higher-is-better";
  subtitle?: string;
}) {
  const values = products.map(valueFn);
  const highlights = useComparisonHighlight(values, mode);
  return (
    <TableRow>
      <TableCell className="font-medium bg-muted/50 sticky left-0">
        <div>
          <div>{label}</div>
          {subtitle && <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{subtitle}</div>}
        </div>
      </TableCell>
      {products.map((_, idx) => (
        <TableCell key={`cell-${idx}`} className={cn("text-center", highlightClasses[highlights[idx]])}>
          <div className="flex items-center justify-center gap-1">
            {highlights[idx] === "best" && <Crown className="h-3.5 w-3.5 text-success" />}
            <span className={cn(
              highlights[idx] === "best" ? "font-semibold text-success" :
              highlights[idx] === "worst" ? "text-destructive" : ""
            )}>
              {renderFn(values[idx])}
            </span>
            {highlights[idx] === "worst" && <AlertTriangle className="h-3 w-3 text-destructive" />}
          </div>
        </TableCell>
      ))}
    </TableRow>
  );
}
