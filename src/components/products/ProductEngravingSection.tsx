/**
 * ProductEngravingSection — Seção read-only da PDP
 *
 * Exibe os LOCAIS e TÉCNICAS de gravação disponíveis para o produto, direto na
 * página de detalhe. Os dados vêm da RPC v6 `fn_get_product_customization_options`
 * (via useProductEngravingOptions) — a MESMA fonte consumida pelo Simulador,
 * garantindo paridade total e fonte única de verdade.
 *
 * Não renderiza nada enquanto carrega ou quando o produto não tem áreas de
 * gravação ativas — evita divisória/skeleton órfão em produtos sem
 * personalização. O botão "Simular preço" abre o Simulador já com o produto
 * pré-selecionado (mesmo contrato de `preSelectedProduct`).
 *
 * ROBUSTEZ (validado contra o catálogo em 2026-06-21, 3.146 produtos):
 * a RPC pode emitir locais com `location_name`/`location_order` nulos (744
 * linhas / 178 produtos) e o MESMO `location_code` repetido com (name,order)
 * divergentes (64 produtos) — sendo que as `options` são idênticas por código.
 * Por isso aqui deduplicamos por location_code (nome preenchido vence a versão
 * em branco), aplicamos fallback de rótulo, ordenamos com nulos por último e
 * formatamos dimensões de forma defensiva (esconde a linha se vier inválida,
 * nunca chama .toFixed em valor não-numérico).
 */
import { memo, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Palette, Ruler, Layers, Calculator, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useProductEngravingOptions } from '@/hooks/products/useProductEngravingOptions';
import type { GravacaoLocation } from '@/types/customization';

interface ProductEngravingSectionProps {
  productId: string;
  productName: string;
  productSku: string;
  productPrice: number;
  productImageUrl?: string | null;
  categoryName?: string | null;
  className?: string;
}

const formatDimensions = (
  width: number | null | undefined,
  height: number | null | undefined,
): string | null => {
  const fmt = (n: number | null | undefined): string | null => {
    if (typeof n !== 'number' || !Number.isFinite(n)) return null;
    return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',');
  };
  const w = fmt(width);
  const h = fmt(height);
  if (w === null || h === null) return null;
  return `${w} × ${h} cm`;
};

const formatColors = (maxColors: number | null | undefined): string =>
  typeof maxColors === 'number' && maxColors > 1 ? `até ${maxColors} cores` : '1 cor';

export const ProductEngravingSection = memo(
  ({
    productId,
    productName,
    productSku,
    productPrice,
    productImageUrl,
    categoryName,
    className,
  }: ProductEngravingSectionProps) => {
    const navigate = useNavigate();
    const { data: locations = [], isLoading } = useProductEngravingOptions(productId);

    // Deduplica por location_code: a RPC calcula as options apenas por código,
    // então códigos repetidos têm options idênticas. A versão com nome
    // preenchido vence a versão em branco. Ordena com location_order nulo por
    // último (Number.isFinite cobre o caso de null vindo da RPC apesar do tipo).
    const visibleLocations = useMemo(() => {
      const ord = (n: number) => (Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER);
      const byCode = new Map<string, GravacaoLocation>();
      for (const loc of locations) {
        if (loc.options.length === 0) continue;
        const existing = byCode.get(loc.location_code);
        if (!existing) {
          byCode.set(loc.location_code, loc);
        } else if (!(existing.location_name || '').trim() && (loc.location_name || '').trim()) {
          byCode.set(loc.location_code, loc);
        }
      }
      return [...byCode.values()].sort((a, b) => ord(a.location_order) - ord(b.location_order));
    }, [locations]);

    if (isLoading || visibleLocations.length === 0) return null;

    const totalTechniques = visibleLocations.reduce((sum, loc) => sum + loc.options.length, 0);

    const handleSimulate = () => {
      navigate('/simulador', {
        state: {
          preSelectedProduct: {
            id: productId,
            name: productName,
            sku: productSku,
            price: productPrice,
            imageUrl: productImageUrl ?? null,
            categoryName: categoryName ?? null,
          },
        },
      });
    };

    return (
      <section
        className={cn('border-t border-border/60 pt-6 xl:pt-8', className)}
        aria-labelledby="product-engraving-title"
      >
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg bg-gradient-to-br from-primary to-primary/80 p-2 shadow-md shadow-primary/25">
                <Palette className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <h2
                  id="product-engraving-title"
                  className="font-display text-base font-bold tracking-tight sm:text-lg"
                >
                  Gravação disponível
                </h2>
                <p className="text-xs text-muted-foreground">
                  {visibleLocations.length} {visibleLocations.length === 1 ? 'local' : 'locais'} ·{' '}
                  {totalTechniques} {totalTechniques === 1 ? 'técnica' : 'técnicas'}
                </p>
              </div>
            </div>

            <Button size="sm" className="h-8 gap-1.5" onClick={handleSimulate}>
              <Calculator className="h-3.5 w-3.5" />
              <span className="text-xs">Simular preço</span>
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visibleLocations.map((loc) => {
              const locationLabel =
                (loc.location_name || '').trim() || loc.location_code || 'Área de gravação';
              return (
                <div
                  key={loc.location_code}
                  className="rounded-xl border border-border/50 bg-background/50 p-4"
                >
                  <div className="mb-3 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    <span className="text-sm font-semibold">{locationLabel}</span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {loc.options.map((opt) => {
                      const dims = formatDimensions(opt.efetiva_largura_max, opt.efetiva_altura_max);
                      return (
                        <div
                          key={opt.technique_id}
                          className="flex flex-col gap-0.5 rounded-lg border border-border/50 bg-secondary/40 px-2.5 py-1.5"
                        >
                          <span className="text-xs font-medium leading-tight">
                            {opt.tecnica_nome}
                          </span>
                          <span className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            {dims && (
                              <span className="inline-flex items-center gap-0.5">
                                <Ruler className="h-2.5 w-2.5" />
                                {dims}
                              </span>
                            )}
                            <span className="inline-flex items-center gap-0.5">
                              <Layers className="h-2.5 w-2.5" />
                              {formatColors(opt.max_cores)}
                            </span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    );
  },
);

ProductEngravingSection.displayName = 'ProductEngravingSection';
