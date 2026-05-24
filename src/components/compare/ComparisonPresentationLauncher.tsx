/**
 * ComparisonPresentationLauncher — Slide deck fullscreen 1 produto/slide + slide final tabela.
 * Atalhos: ← → navega, Esc fecha, F fullscreen do browser.
 */
import { useState, useEffect, useCallback } from "react";
import type { Product } from "@/types/product-catalog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, X, Maximize, Crown, Presentation } from "lucide-react";
import { cn } from "@/lib/utils";
import { useComparisonScore, type ProductScore } from "@/hooks/comparison";

interface Props {
  products: Product[];
  formatCurrency: (v: number) => string;
  trigger?: React.ReactNode;
}

export function ComparisonPresentationLauncher({ products, formatCurrency, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [slide, setSlide] = useState(0);
  const totalSlides = products.length + 1; // +1 para slide final tabela
  const { items: scoreItems = [] } = useComparisonScore(products) || { items: [] };
  const winnerIdx = (scoreItems && scoreItems.length > 0)
    ? scoreItems.reduce((best: number, cur: ProductScore, idx: number, arr: ProductScore[]) => cur.total > arr[best].total ? idx : best, 0)
    : -1;

  const next = useCallback(() => setSlide(s => Math.min(s + 1, totalSlides - 1)), [totalSlides]);
  const prev = useCallback(() => setSlide(s => Math.max(s - 1, 0)), []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
      else if (e.key === "Escape") { setOpen(false); }
      else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => { /* noop */ });
        } else {
          document.exitFullscreen().catch(() => { /* noop */ });
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, next, prev]);

  useEffect(() => {
    if (open) setSlide(0);
  }, [open]);

  const isFinal = slide === products.length;

  return (
    <>
      <span onClick={() => setOpen(true)}>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <Presentation className="h-4 w-4 mr-2" />
            Modo apresentação
          </Button>
        )}
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[98vw] w-full h-[95vh] p-0 bg-background border-none overflow-hidden">
          <div className="relative w-full h-full flex flex-col">
            {/* Header bar */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card/50 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <Badge variant="outline">{slide + 1} / {totalSlides}</Badge>
                <span className="text-sm text-muted-foreground">
                  {isFinal ? "Resumo comparativo" : products[slide]?.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => document.documentElement.requestFullscreen().catch(() => {})} aria-label="Fullscreen">
                  <Maximize className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Fechar">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Slide content */}
            <div className="flex-1 overflow-auto p-8 sm:p-12">
              {isFinal ? (
                <FinalSlide products={products} formatCurrency={formatCurrency} winnerIdx={winnerIdx} />
              ) : (
                <ProductSlide product={products[slide]} idx={slide} formatCurrency={formatCurrency} isWinner={winnerIdx === slide} />
              )}
            </div>

            {/* Nav controls */}
            <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-card/50">
              <Button variant="outline" onClick={prev} disabled={slide === 0}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Anterior
              </Button>
              <div className="flex gap-1.5">
                {Array.from({ length: totalSlides }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setSlide(i)}
                    aria-label={`Ir para slide ${i + 1}`}
                    className={cn(
                      "h-2 rounded-full transition-all",
                      i === slide ? "w-8 bg-primary" : "w-2 bg-muted hover:bg-muted-foreground/40"
                    )}
                  />
                ))}
              </div>
              <Button variant="outline" onClick={next} disabled={slide === totalSlides - 1}>
                Próximo
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ProductSlide({ product, idx, formatCurrency, isWinner }: {
  product: Product;
  idx: number;
  formatCurrency: (v: number) => string;
  isWinner: boolean;
}) {
  if (!product) return null;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 max-w-7xl mx-auto h-full items-center">
      <div className="relative aspect-square rounded-2xl bg-muted overflow-hidden">
        <img src={product.images?.[0]} alt={product.name} className="w-full h-full object-contain p-8" loading="lazy" />
        {isWinner && (
          <Badge className="absolute top-4 left-4 bg-primary text-primary-foreground gap-1.5 shadow-xl text-sm py-1.5 px-3">
            <Crown className="h-4 w-4" />
            Recomendado
          </Badge>
        )}
      </div>
      <div className="space-y-5">
        <p className="text-sm uppercase tracking-widest text-muted-foreground">Produto {idx + 1}</p>
        <h2 className="font-display text-3xl sm:text-5xl font-bold leading-tight">{product.name}</h2>
        <p className="text-5xl sm:text-6xl font-bold text-primary tabular-nums">{formatCurrency(product.price)}</p>
        <div className="grid grid-cols-2 gap-4 pt-4">
          <Stat label="Quantidade mínima" value={`${product.minQuantity ?? 0} un.`} />
          <Stat label="Estoque" value={`${product.stock ?? 0} un.`} />
          <Stat label="Cores disponíveis" value={`${product.colors?.length ?? 0}`} />
          <Stat label="Fornecedor" value={product.supplier?.name ?? "—"} />
        </div>
        {product.description && (
          <p className="text-base text-muted-foreground line-clamp-4 pt-2">{product.description}</p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-muted/50 p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <p className="text-xl font-display font-semibold">{value}</p>
    </div>
  );
}

function FinalSlide({ products, formatCurrency, winnerIdx }: {
  products: Product[];
  formatCurrency: (v: number) => string;
  winnerIdx: number;
}) {
  return (
    <div className="max-w-7xl mx-auto h-full flex flex-col justify-center">
      <h2 className="font-display text-3xl sm:text-4xl font-bold mb-8 text-center">Resumo comparativo</h2>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-border">
              <th className="text-left p-3 text-sm uppercase tracking-wider text-muted-foreground">Produto</th>
              <th className="text-right p-3 text-sm uppercase tracking-wider text-muted-foreground">Preço</th>
              <th className="text-right p-3 text-sm uppercase tracking-wider text-muted-foreground">Qtd. mín.</th>
              <th className="text-right p-3 text-sm uppercase tracking-wider text-muted-foreground">Estoque</th>
              <th className="text-right p-3 text-sm uppercase tracking-wider text-muted-foreground">Cores</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p, idx) => (
              <tr key={p.id} className={cn("border-b border-border", winnerIdx === idx && "bg-primary/5")}>
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <img src={p.images?.[0]} alt={p.name} className="w-12 h-12 object-contain rounded bg-muted" loading="lazy" />
                    <div>
                      <p className="font-medium">{p.name}</p>
                      {winnerIdx === idx && (
                        <Badge className="mt-1 text-[10px] gap-1"><Crown className="h-2.5 w-2.5" />Recomendado</Badge>
                      )}
                    </div>
                  </div>
                </td>
                <td className="p-3 text-right text-lg font-bold text-primary tabular-nums">{formatCurrency(p.price)}</td>
                <td className="p-3 text-right tabular-nums">{p.minQuantity ?? 0}</td>
                <td className="p-3 text-right tabular-nums">{p.stock ?? 0}</td>
                <td className="p-3 text-right tabular-nums">{p.colors?.length ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-center text-sm text-muted-foreground mt-8">
        Use ← → para navegar · F para tela cheia · Esc para sair
      </p>
    </div>
  );
}
