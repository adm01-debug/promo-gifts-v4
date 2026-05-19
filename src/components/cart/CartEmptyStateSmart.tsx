/**
 * CartEmptyStateSmart - Empty state com 3 CTAs inteligentes:
 * Aplicar template, Duplicar último carrinho desta empresa, Explorar catálogo.
 */
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LayoutTemplate, Copy, Package, Sparkles, ArrowRight } from "lucide-react";
import { type CartTemplateItem, type SellerCart } from "@/hooks/products";
import { cn } from "@/lib/utils";

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
  activeCart, templates, otherCarts,
  onApplyTemplate, onDuplicateLast, onNavigateProducts,
}: CartEmptyStateSmartProps) {
  const topTemplates = templates.slice(0, 3);
  const lastCartSameCompany = otherCarts
    .filter(c => c.company_id === activeCart.company_id && c.items.length > 0)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];

  return (
    <div className="space-y-4 animate-in fade-in zoom-in duration-500 max-w-4xl mx-auto">
      <div className="text-center pt-8 pb-4">
        <div className="relative w-20 h-20 mx-auto mb-5">
          <div className="absolute inset-0 bg-primary/20 rounded-[2rem] blur-2xl animate-pulse" />
          <div className="relative w-20 h-20 rounded-[2rem] bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20 shadow-inner">
            <Sparkles className="h-9 w-9 text-primary animate-bounce-slow" />
          </div>
        </div>
        <h3 className="font-display text-2xl font-bold mb-2 tracking-tight text-foreground/90">O carrinho está aguardando você</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">Vincule uma empresa e adicione produtos para gerar orçamentos profissionais em segundos.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-2">
        {/* Template */}
        <Card className={cn(
          "p-5 flex flex-col gap-4 border-border/40 hover:border-primary/40 hover:bg-primary/[0.02] transition-all duration-300 group shadow-sm hover:shadow-md",
          topTemplates.length === 0 && "opacity-50 grayscale-[0.5]"
        )}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center transition-transform group-hover:scale-110">
              <LayoutTemplate className="h-5 w-5 text-primary" />
            </div>
            <h4 className="font-bold text-sm tracking-tight">Aplicar template</h4>
          </div>
          {topTemplates.length > 0 ? (
            <>
              <ul className="space-y-2 text-xs text-muted-foreground flex-1">
                {topTemplates.map(t => (
                  <li key={t.id} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    <span className="truncate font-medium">{t.name}</span>
                    <span className="tabular-nums text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{t.items.length} itens</span>
                  </li>
                ))}
              </ul>
              <Button
                size="sm"
                variant="outline"
                className="w-full gap-2 text-xs h-9 font-semibold group-hover:border-primary/50 group-hover:text-primary transition-all"
                onClick={() => onApplyTemplate(topTemplates[0].items)}
              >
                Aplicar "{topTemplates[0].name}" <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </Button>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center py-4 border-2 border-dashed border-border/20 rounded-xl">
              <p className="text-[11px] text-muted-foreground text-center px-4">Crie templates a partir de carrinhos existentes para acelerar seu fluxo.</p>
            </div>
          )}
        </Card>

        {/* Duplicate last */}
        <Card className={cn(
          "p-5 flex flex-col gap-4 border-border/40 hover:border-primary/40 hover:bg-primary/[0.02] transition-all duration-300 group shadow-sm hover:shadow-md",
          !lastCartSameCompany && "opacity-50 grayscale-[0.5]"
        )}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center transition-transform group-hover:scale-110">
              <Copy className="h-5 w-5 text-primary" />
            </div>
            <h4 className="font-bold text-sm tracking-tight">Duplicar anterior</h4>
          </div>
          {lastCartSameCompany ? (
            <>
              <div className="flex-1 bg-muted/30 p-3 rounded-xl border border-border/20 space-y-2">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Último carrinho para <span className="font-bold text-foreground">{lastCartSameCompany.company_name}</span>.
                </p>
                <div className="flex items-center gap-2">
                   <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                     {lastCartSameCompany.items.length}
                   </div>
                   <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Itens encontrados</span>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full gap-2 text-xs h-9 font-semibold group-hover:border-primary/50 group-hover:text-primary transition-all"
                onClick={() => onDuplicateLast(lastCartSameCompany)}
              >
                Copiar itens <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </Button>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center py-4 border-2 border-dashed border-border/20 rounded-xl">
              <p className="text-[11px] text-muted-foreground text-center px-4">Nenhum histórico recente para esta empresa no momento.</p>
            </div>
          )}
        </Card>

        {/* Catalog */}
        <Card className="p-5 flex flex-col gap-4 border-border/40 hover:border-primary/40 hover:bg-primary/[0.02] transition-all duration-300 group shadow-sm hover:shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center transition-transform group-hover:scale-110">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <h4 className="font-bold text-sm tracking-tight">Explorar catálogo</h4>
          </div>
          <div className="flex-1 flex flex-col justify-center space-y-2">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Navegue pelo catálogo completo com <span className="font-bold text-foreground">+5.000 SKUs</span> e monte do zero.
            </p>
            <div className="flex -space-x-2 overflow-hidden">
               {[1,2,3,4].map(i => (
                 <div key={i} className="inline-block h-6 w-6 rounded-full ring-2 ring-background bg-muted border border-border/30" />
               ))}
               <div className="flex items-center justify-center h-6 w-6 rounded-full ring-2 ring-background bg-primary/10 text-primary text-[8px] font-bold">+99</div>
            </div>
          </div>
          <Button
            size="sm"
            className="w-full gap-2 text-xs h-9 font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 transition-all group-hover:scale-[1.02]"
            onClick={onNavigateProducts}
          >
            Ir ao catálogo <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
          </Button>
        </Card>
      </div>
    </div>
  );
}
