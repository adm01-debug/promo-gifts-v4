/**
 * CartEmptyStateSmart - Empty state com 3 CTAs inteligentes:
 * Aplicar template, Duplicar último carrinho desta empresa, Explorar catálogo.
 */
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LayoutTemplate, Copy, Package, Sparkles, ArrowRight } from 'lucide-react';
import type { CartTemplateItem, SellerCart } from '@/hooks/products';
import { cn } from '@/lib/utils';

interface SmartTemplate {
  id: string;
  name: string;
  description?: string;
  items: CartTemplateItem[];
}

interface CartEmptyStateSmartProps {
  activeCart: SellerCart;
  templates: SmartTemplate[];
  otherCarts: SellerCart[];
  onApplyTemplate: (items: CartTemplateItem[]) => void;
  onDuplicateLast: (sourceCart: SellerCart) => void;
  onNavigateProducts: () => void;
}

export function CartEmptyStateSmart({
  activeCart,
  templates,
  otherCarts,
  onApplyTemplate,
  onDuplicateLast,
  onNavigateProducts,
}: CartEmptyStateSmartProps) {
  const topTemplates = templates.slice(0, 3);
  const lastCartSameCompany = otherCarts
    .filter((c) => c.company_id === activeCart.company_id && c.items.length > 0)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];

  return (
    <div className="mx-auto max-w-4xl space-y-4 duration-500 animate-in fade-in zoom-in">
      <div className="pb-4 pt-8 text-center">
        <div className="relative mx-auto mb-5 h-20 w-20">
          <div className="absolute inset-0 animate-pulse rounded-[2rem] bg-primary/20 blur-2xl" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-[2rem] border border-primary/20 bg-gradient-to-br from-primary/20 to-primary/5 shadow-inner">
            <Sparkles className="animate-bounce-slow h-9 w-9 text-primary" />
          </div>
        </div>
        <h3 className="mb-2 font-display text-2xl font-bold tracking-tight text-foreground/90">
          O carrinho está aguardando você
        </h3>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          Vincule uma empresa e adicione produtos para gerar orçamentos profissionais em segundos.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 px-2 md:grid-cols-3">
        {/* Template */}
        <Card
          className={cn(
            'group flex flex-col gap-4 border-border/40 p-5 shadow-sm transition-all duration-300 hover:border-primary/40 hover:bg-primary/[0.02] hover:shadow-md',
            topTemplates.length === 0 && 'opacity-50 grayscale-[0.5]',
          )}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 transition-transform group-hover:scale-110">
              <LayoutTemplate className="h-5 w-5 text-primary" />
            </div>
            <h4 className="text-sm font-bold tracking-tight">Aplicar template</h4>
          </div>
          {topTemplates.length > 0 ? (
            <>
              <ul className="flex-1 space-y-2 text-xs text-muted-foreground">
                {topTemplates.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-3 rounded-lg bg-muted/30 p-2 transition-colors hover:bg-muted/50"
                  >
                    <span className="truncate font-medium">{t.name}</span>
                    <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] tabular-nums text-primary">
                      {t.items.length} itens
                    </span>
                  </li>
                ))}
              </ul>
              <Button
                size="sm"
                variant="outline"
                className="h-9 w-full gap-2 text-xs font-semibold transition-all group-hover:border-primary/50 group-hover:text-primary"
                onClick={() => onApplyTemplate(topTemplates[0].items)}
              >
                Aplicar "{topTemplates[0].name}"{' '}
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </Button>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/20 py-4">
              <p className="px-4 text-center text-[11px] text-muted-foreground">
                Crie templates a partir de carrinhos existentes para acelerar seu fluxo.
              </p>
            </div>
          )}
        </Card>

        {/* Duplicate last */}
        <Card
          className={cn(
            'group flex flex-col gap-4 border-border/40 p-5 shadow-sm transition-all duration-300 hover:border-primary/40 hover:bg-primary/[0.02] hover:shadow-md',
            !lastCartSameCompany && 'opacity-50 grayscale-[0.5]',
          )}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 transition-transform group-hover:scale-110">
              <Copy className="h-5 w-5 text-primary" />
            </div>
            <h4 className="text-sm font-bold tracking-tight">Duplicar anterior</h4>
          </div>
          {lastCartSameCompany ? (
            <>
              <div className="flex-1 space-y-2 rounded-xl border border-border/20 bg-muted/30 p-3">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Último carrinho para{' '}
                  <span className="font-bold text-foreground">
                    {lastCartSameCompany.company_name}
                  </span>
                  .
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded bg-primary/10 text-[10px] font-bold text-primary">
                    {lastCartSameCompany.items.length}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Itens encontrados
                  </span>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-9 w-full gap-2 text-xs font-semibold transition-all group-hover:border-primary/50 group-hover:text-primary"
                onClick={() => onDuplicateLast(lastCartSameCompany)}
              >
                Copiar itens{' '}
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </Button>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/20 py-4">
              <p className="px-4 text-center text-[11px] text-muted-foreground">
                Nenhum histórico recente para esta empresa no momento.
              </p>
            </div>
          )}
        </Card>

        {/* Catalog */}
        <Card className="group flex flex-col gap-4 border-border/40 p-5 shadow-sm transition-all duration-300 hover:border-primary/40 hover:bg-primary/[0.02] hover:shadow-md">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 transition-transform group-hover:scale-110">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <h4 className="text-sm font-bold tracking-tight">Explorar catálogo</h4>
          </div>
          <div className="flex flex-1 flex-col justify-center space-y-2">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Navegue pelo catálogo completo com{' '}
              <span className="font-bold text-foreground">+5.000 SKUs</span> e monte do zero.
            </p>
            <div className="flex -space-x-2 overflow-hidden">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="inline-block h-6 w-6 rounded-full border border-border/30 bg-muted ring-2 ring-background"
                />
              ))}
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[8px] font-bold text-primary ring-2 ring-background">
                +99
              </div>
            </div>
          </div>
          <Button
            size="sm"
            className="h-9 w-full gap-2 bg-primary text-xs font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 group-hover:scale-[1.02]"
            onClick={onNavigateProducts}
          >
            Ir ao catálogo{' '}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
          </Button>
        </Card>
      </div>
    </div>
  );
}
