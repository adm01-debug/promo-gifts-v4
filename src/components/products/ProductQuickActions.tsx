/**
 * ProductQuickActions — 5 quick-access modal buttons for product detail page.
 * Tabela de Preços | Personalização | Indicação | Nicho | WhatsApp
 */
import { useState } from "react";
import { TableProperties, Palette, Target, Layers } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { InlinePriceCalculator } from "@/components/products/InlinePriceCalculator";
import { ProductCustomizationOptions } from "@/components/products/ProductCustomizationOptions";
import { ProductPersonalizationRules } from "@/components/products/ProductPersonalizationRules";
import { ShareActions } from "@/components/products/ShareActions";
import type { Product } from "@/hooks/products";

interface ProductQuickActionsProps {
  productId: string;
  productName: string;
  productSku?: string;
  basePrice: number;
  minQuantity: number;
  tags?: Record<string, string[]>;
  niches?: string[];
  product?: Product;
  selectedVariant?: { variantName?: string | null; colorHex?: string | null; thumbnailUrl?: string | null } | null;
  onConfirmPrice?: () => void;
  priceConfirmedAt?: string | Date | null;
}

type ModalType = "precos" | "personalizacao" | "indicacao" | "nicho" | null;
type ActionKey = Exclude<ModalType, null>;

const actions = [
  { key: "precos" as const, label: "Preços", icon: TableProperties, iconColor: "text-primary" },
  { key: "personalizacao" as const, label: "Gravação", icon: Palette, iconColor: "text-accent-foreground" },
  { key: "indicacao" as const, label: "Indicação", icon: Target, iconColor: "text-primary" },
  { key: "nicho" as const, label: "Nicho", icon: Layers, iconColor: "text-accent-foreground" },
];

const categoryIcons: Record<string, string> = {
  "Público-Alvo": "👥",
  "Datas Comemorativas": "📅",
  Endomarketing: "🎯",
};

export function ProductQuickActions({
  productId,
  productName,
  productSku,
  basePrice,
  minQuantity,
  tags,
  niches,
  product,
  selectedVariant,
  onConfirmPrice,
  priceConfirmedAt,
}: ProductQuickActionsProps) {
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  const displayTagSections = Object.entries(tags ?? {})
    .map(([category, items]) => [category, items.filter((item) => item?.trim().length > 0)] as const)
    .filter(([, items]) => items.length > 0);

  const displayNiches = Array.from(
    new Set((niches ?? []).map((niche) => niche?.trim()).filter((niche): niche is string => Boolean(niche)))
  );

  const isActionDisabled = (key: ActionKey) => {
    if (key === "indicacao") return displayTagSections.length === 0;
    if (key === "nicho") return displayNiches.length === 0;
    return false;
  };

  const handleClick = (key: ActionKey) => {
    if (isActionDisabled(key)) return;
    setActiveModal(key);
  };

  return (
    <>
      <div className="flex flex-col gap-3 pt-2 w-full">
        {onConfirmPrice && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/40">
            <div className="flex items-center gap-2">
              <TableProperties className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium">Validar preço com fornecedor?</span>
            </div>
            <button
              onClick={onConfirmPrice}
              className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
            >
              Confirmar agora
            </button>
          </div>
        )}
        <div className="flex items-center gap-2 w-full">
          {actions.map(({ key, label, icon: Icon, iconColor }) => {
            const disabled = isActionDisabled(key);

            return (
              <button
                key={key}
                type="button"
                disabled={disabled}
                onClick={() => handleClick(key)}
                title={disabled ? `Sem dados de ${label.toLowerCase()} para este produto` : undefined}
                className={cn(
                  "group relative inline-flex items-center justify-center gap-2 flex-1 px-4 py-3 rounded-lg text-xs font-bold border overflow-hidden",
                  "transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  disabled
                    ? "bg-muted/30 text-muted-foreground/50 border-border/20 cursor-not-allowed"
                    : "bg-card text-foreground border-border/40 shadow-sm hover:border-primary/50 hover:shadow-lg hover:shadow-primary/15 hover:-translate-y-1 hover:scale-[1.02] active:translate-y-0 active:scale-100 active:shadow-sm"
                )}
              >
                <Icon className={cn(
                  "h-4 w-4 shrink-0 transition-all duration-300",
                  disabled ? "opacity-40" : cn(iconColor, "group-hover:scale-125 group-hover:rotate-6 group-hover:drop-shadow-sm")
                )} />
                {label}
              </button>
            );
          })}
        </div>

        {product && <ShareActions product={product} selectedVariant={selectedVariant} />}
      </div>

      <Dialog open={activeModal === "precos"} onOpenChange={(o) => !o && setActiveModal(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TableProperties className="h-5 w-5 text-primary" />
              Tabela de Preços
            </DialogTitle>
            <DialogDescription>Veja os descontos por quantidade</DialogDescription>
          </DialogHeader>
          <InlinePriceCalculator
            productId={productId}
            productName={productName}
            basePrice={basePrice}
            minQuantity={minQuantity}
            defaultOpen
          />
        </DialogContent>
      </Dialog>

      <Dialog open={activeModal === "personalizacao"} onOpenChange={(o) => !o && setActiveModal(null)}>
        <DialogContent className="max-w-md max-h-[72vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" />
              Personalização
            </DialogTitle>
            <DialogDescription>Técnicas e locais de gravação disponíveis</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <ProductCustomizationOptions productId={productId} productSku={productSku} />
            <ProductPersonalizationRules productId={productId} productSku={productSku} productName={productName} />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={activeModal === "indicacao"} onOpenChange={(o) => !o && setActiveModal(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <div className="px-5 pt-5 pb-3 border-b border-border/40">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Target className="h-5 w-5 text-primary" />
                Indicado para
              </DialogTitle>
              <DialogDescription className="text-xs">Público-alvo e ocasiões recomendadas</DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-5 py-5 space-y-5">
            {displayTagSections.length > 0 ? (
              displayTagSections.map(([category, items]) => (
                <div key={category} className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{categoryIcons[category] ?? "•"}</span>
                    <h4 className="text-[11px] font-bold text-foreground uppercase tracking-widest">
                      {category}
                    </h4>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {items.map((item) => (
                      <span
                        key={item}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-foreground border border-border/40"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma indicação cadastrada para este produto.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={activeModal === "nicho"} onOpenChange={(o) => !o && setActiveModal(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <div className="px-5 pt-5 pb-3 border-b border-border/40">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Layers className="h-5 w-5 text-primary" />
                Nichos / Segmentos
              </DialogTitle>
              <DialogDescription className="text-xs">Segmentos de mercado compatíveis</DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-5 py-5 space-y-3">
            {displayNiches.length > 0 ? (
              displayNiches.map((niche) => (
                <div
                  key={niche}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-muted/45 border border-border/40"
                >
                  <div className="w-2.5 h-2.5 rounded-full bg-primary shrink-0" />
                  <span className="text-sm font-medium text-foreground">{niche}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum nicho cadastrado para este produto.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
