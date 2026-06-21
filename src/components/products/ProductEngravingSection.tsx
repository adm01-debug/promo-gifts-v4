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
 */
import { memo, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Palette, Ruler, Layers, Calculator, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useProductEngravingOptions } from '@/hooks/products/useProductEngravingOptions';

interface ProductEngravingSectionProps {
  productId: string;
  productName: string;
  productSku: string;
  productPrice: number;
  productImageUrl?: string | null;
  categoryName?: string | null;
  className?: string;
}

const formatDimensions = (width: number, height: number): string => {
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','));
  return `${fmt(width)} × ${fmt(height)} cm`;
};

const formatColors = (maxColors: number): string =>
  maxColors <= 1 ? '1 cor' : `até ${maxColors} cores`;

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

    const visibleLocations = useMemo(
      () =>
        [...locations]
          .filter((loc) => loc.options.length > 0)
          .sort((a, b) => a.location_order - b.location_order),
      [locations],
    );

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
            {visibleLocations.map((loc) => (
              <div
                key={loc.location_code}
                className="rounded-xl border border-border/50 bg-background/50 p-4"
              >
                <div className="mb-3 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  <span className="text-sm font-semibold">{loc.location_name}</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {loc.options.map((opt) => (
                    <div
                      key={opt.technique_id}
                      className="flex flex-col gap-0.5 rounded-lg border border-border/50 bg-secondary/40 px-2.5 py-1.5"
                    >
                      <span className="text-xs font-medium leading-tight">{opt.tecnica_nome}</span>
                      <span className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="inline-flex items-center gap-0.5">
                          <Ruler className="h-2.5 w-2.5" />
                          {formatDimensions(opt.efetiva_largura_max, opt.efetiva_altura_max)}
                        </span>
                        <span className="inline-flex items-center gap-0.5">
                          <Layers className="h-2.5 w-2.5" />
                          {formatColors(opt.max_cores)}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  },
);

ProductEngravingSection.displayName = 'ProductEngravingSection';
