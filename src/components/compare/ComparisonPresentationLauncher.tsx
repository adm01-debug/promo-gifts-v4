/**
 * ComparisonPresentationLauncher — Slide deck fullscreen 1 produto/slide + slide final tabela.
 * Atalhos: ← → navega, Esc fecha, F fullscreen do browser.
 */
import { useState, useEffect, useCallback } from 'react';
import type { Product } from '@/types/product-catalog';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, X, Maximize, Crown, Presentation } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useComparisonScore } from '@/hooks/comparison';

interface Props {
  products: Product[];
  formatCurrency: (v: number) => string;
  trigger?: React.ReactNode;
}

export function ComparisonPresentationLauncher({ products, formatCurrency, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [slide, setSlide] = useState(0);
  const totalSlides = products.length + 1; // +1 para slide final tabela
  const scoreItems = useComparisonScore(products);
  const winnerIdx =
    scoreItems.length > 0
      ? scoreItems.reduce((best, cur, idx, arr) => (cur.total > arr[best].total ? idx : best), 0)
      : -1;

  const next = useCallback(() => setSlide((s) => Math.min(s + 1, totalSlides - 1)), [totalSlides]);
  const prev = useCallback(() => setSlide((s) => Math.max(s - 1, 0)), []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prev();
      } else if (e.key === 'Escape') {
        setOpen(false);
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {
            /* noop */
          });
        } else {
          document.exitFullscreen().catch(() => {
            /* noop */
          });
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
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
            <Presentation className="mr-2 h-4 w-4" />
            Modo apresentação
          </Button>
        )}
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="h-[95vh] w-full max-w-[98vw] overflow-hidden border-none bg-background p-0">
          <div className="relative flex h-full w-full flex-col">
            {/* Header bar */}
            <div className="flex items-center justify-between border-b border-border bg-card/50 px-6 py-3 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <Badge variant="outline">
                  {slide + 1} / {totalSlides}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {isFinal ? 'Resumo comparativo' : products[slide]?.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => document.documentElement.requestFullscreen().catch(() => {})}
                  aria-label="Fullscreen"
                >
                  <Maximize className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setOpen(false)}
                  aria-label="Fechar"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Slide content */}
            <div className="flex-1 overflow-auto p-8 sm:p-12">
              {isFinal ? (
                <FinalSlide
                  products={products}
                  formatCurrency={formatCurrency}
                  winnerIdx={winnerIdx}
                />
              ) : (
                <ProductSlide
                  product={products[slide]}
                  idx={slide}
                  formatCurrency={formatCurrency}
                  isWinner={winnerIdx === slide}
                />
              )}
            </div>

            {/* Nav controls */}
            <div className="flex items-center justify-between border-t border-border bg-card/50 px-6 py-3">
              <Button variant="outline" onClick={prev} disabled={slide === 0}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Anterior
              </Button>
              <div className="flex gap-1.5">
                {Array.from({ length: totalSlides }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setSlide(i)}
                    aria-label={`Ir para slide ${i + 1}`}
                    className={cn(
                      'h-2 rounded-full transition-all',
                      i === slide ? 'w-8 bg-primary' : 'w-2 bg-muted hover:bg-muted-foreground/40',
                    )}
                  />
                ))}
              </div>
              <Button variant="outline" onClick={next} disabled={slide === totalSlides - 1}>
                Próximo
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ProductSlide({
  product,
  idx,
  formatCurrency,
  isWinner,
}: {
  product: Product;
  idx: number;
  formatCurrency: (v: number) => string;
  isWinner: boolean;
}) {
  if (!product) return null;
  return (
    <div className="mx-auto grid h-full max-w-7xl grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-16">
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted">
        <img
          src={product.images?.[0]}
          alt={product.name}
          className="h-full w-full object-contain p-8"
          loading="lazy"
        />
        {isWinner && (
          <Badge className="absolute left-4 top-4 gap-1.5 bg-primary px-3 py-1.5 text-sm text-primary-foreground shadow-xl">
            <Crown className="h-4 w-4" />
            Recomendado
          </Badge>
        )}
      </div>
      <div className="space-y-5">
        <p className="text-sm uppercase tracking-widest text-muted-foreground">Produto {idx + 1}</p>
        <h2 className="font-display text-3xl font-bold leading-tight sm:text-5xl">
          {product.name}
        </h2>
        <p className="text-5xl font-bold tabular-nums text-primary sm:text-6xl">
          {formatCurrency(product.price)}
        </p>
        <div className="grid grid-cols-2 gap-4 pt-4">
          <Stat label="Quantidade mínima" value={`${product.minQuantity ?? 0} un.`} />
          <Stat label="Estoque" value={`${product.stock ?? 0} un.`} />
          <Stat label="Cores disponíveis" value={`${product.colors?.length ?? 0}`} />
          <Stat label="Fornecedor" value={product.supplier?.name ?? '—'} />
        </div>
        {product.description && (
          <p className="line-clamp-4 pt-2 text-base text-muted-foreground">{product.description}</p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl bg-muted/50 p-4">
      <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-display text-xl font-semibold">{value}</p>
    </div>
  );
}

function FinalSlide({
  products,
  formatCurrency,
  winnerIdx,
}: {
  products: Product[];
  formatCurrency: (v: number) => string;
  winnerIdx: number;
}) {
  return (
    <div className="mx-auto flex h-full max-w-7xl flex-col justify-center">
      <h2 className="mb-8 text-center font-display text-3xl font-bold sm:text-4xl">
        Resumo comparativo
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-border">
              <th className="p-3 text-left text-sm uppercase tracking-wider text-muted-foreground">
                Produto
              </th>
              <th className="p-3 text-right text-sm uppercase tracking-wider text-muted-foreground">
                Preço
              </th>
              <th className="p-3 text-right text-sm uppercase tracking-wider text-muted-foreground">
                Qtd. mín.
              </th>
              <th className="p-3 text-right text-sm uppercase tracking-wider text-muted-foreground">
                Estoque
              </th>
              <th className="p-3 text-right text-sm uppercase tracking-wider text-muted-foreground">
                Cores
              </th>
            </tr>
          </thead>
          <tbody>
            {products.map((p, idx) => (
              <tr
                key={p.id}
                className={cn('border-b border-border', winnerIdx === idx && 'bg-primary/5')}
              >
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={p.images?.[0]}
                      alt={p.name}
                      className="h-12 w-12 rounded bg-muted object-contain"
                      loading="lazy"
                    />
                    <div>
                      <p className="font-medium">{p.name}</p>
                      {winnerIdx === idx && (
                        <Badge className="mt-1 gap-1 text-[10px]">
                          <Crown className="h-2.5 w-2.5" />
                          Recomendado
                        </Badge>
                      )}
                    </div>
                  </div>
                </td>
                <td className="p-3 text-right text-lg font-bold tabular-nums text-primary">
                  {formatCurrency(p.price)}
                </td>
                <td className="p-3 text-right tabular-nums">{p.minQuantity ?? 0}</td>
                <td className="p-3 text-right tabular-nums">{p.stock ?? 0}</td>
                <td className="p-3 text-right tabular-nums">{p.colors?.length ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Use ← → para navegar · F para tela cheia · Esc para sair
      </p>
    </div>
  );
}
