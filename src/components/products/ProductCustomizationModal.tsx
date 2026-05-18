import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Settings2, Palette, Info } from "lucide-react";
import { ProductCustomizationOptions } from "@/components/products/ProductCustomizationOptions";
import { Badge } from "@/components/ui/badge";
import type { QuoteItemPersonalization } from "@/hooks/useQuotes";
import type { PersonalizationItem } from "@/types/customization";

interface ProductCustomizationModalProps {
  productId: string;
  productName?: string;
  quantity: number;
  existingPersonalizations?: QuoteItemPersonalization[];
  onPersonalizationsChange: (personalizations: QuoteItemPersonalization[]) => void;
  trigger?: React.ReactNode;
}

export function ProductCustomizationModal({
  productId,
  productName,
  quantity,
  existingPersonalizations = [],
  onPersonalizationsChange,
  trigger
}: ProductCustomizationModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelectionChange = (items: PersonalizationItem[]) => {
    // We reuse the logic from QuoteProductCustomization but wrapped in this modal context
    // This allows the modal to be the source of truth for "active configuration"
    const updated = [...existingPersonalizations];
    
    items.forEach(item => {
      if (!item.price?.success) return;

      const newP: QuoteItemPersonalization = {
        technique_id: item.techniqueId,
        technique_name: item.techniqueName,
        location_code: item.locationCode,
        location_name: item.locationName,
        colors_count: item.numberOfColors,
        positions_count: 1,
        width_cm: item.width,
        height_cm: item.height,
        personalized_quantity: quantity,
        setup_cost: item.price.setup_total,
        unit_cost: item.price.preco_unitario,
        total_cost: item.price.total_cobrado,
        notes: item.width && item.height
          ? `${item.locationName} — ${item.codigoTabela} | ${item.width}×${item.height}cm`
          : `${item.locationName} — ${item.codigoTabela}`,
      };

      const existingIdx = updated.findIndex(m => m.location_code === newP.location_code);
      if (existingIdx >= 0) {
        updated[existingIdx] = newP;
      } else {
        updated.push(newP);
      }
    });

    onPersonalizationsChange(updated);
  };

  const confirmedCount = existingPersonalizations.length;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button 
            variant={confirmedCount > 0 ? "outline" : "default"}
            size="sm" 
            className="w-full gap-2 relative overflow-hidden group"
          >
            {confirmedCount > 0 ? (
              <>
                <Settings2 className="h-4 w-4 text-primary animate-pulse" />
                <span>Editar Personalização</span>
                <Badge variant="secondary" className="ml-1 px-1.5 h-4 text-[10px]">
                  {confirmedCount}
                </Badge>
              </>
            ) : (
              <>
                <Palette className="h-4 w-4" />
                <span>Configurar Gravação</span>
              </>
            )}
            <div className="absolute inset-0 bg-primary/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 md:p-6 border-b bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Palette className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg md:text-xl font-bold">
                Configurar Personalização
              </DialogTitle>
              <p className="text-sm text-muted-foreground line-clamp-1">
                {productName || "Ajuste as técnicas, locais e cores de gravação"}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden bg-background">
          <div className="grid grid-cols-1 lg:grid-cols-12 h-full">
            {/* Left Column: Context & Selection (Fixed/Sticky Area) */}
            <div className="lg:col-span-3 border-r bg-muted/10 p-4 space-y-4 overflow-y-auto custom-scrollbar">
              <div className="rounded-xl border bg-card p-4 space-y-3 shadow-sm border-primary/20 bg-primary/5">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <Palette className="h-3.5 w-3.5" />
                  Orçamento Atual
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Volume:</span>
                    <span className="font-bold">{quantity} un</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Configurações:</span>
                    <Badge variant="secondary" className="h-4 px-1 text-[10px] font-bold">
                      {confirmedCount}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Lista compacta de gravações já confirmadas (Fixed Summary) */}
              {confirmedCount > 0 && (
                <div className="space-y-2 pt-2 border-t border-border/60">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Confirmados
                  </h4>
                  <div className="grid gap-1.5">
                    {existingPersonalizations.map((p, i) => (
                      <div key={i} className="p-2 rounded-lg bg-card border text-[10px] space-y-0.5">
                        <div className="flex justify-between">
                          <span className="font-bold uppercase text-primary line-clamp-1">{p.location_name}</span>
                          <span className="text-muted-foreground font-medium">
                            {p.total_cost?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                        </div>
                        <p className="text-muted-foreground line-clamp-1">{p.technique_name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Configuration Workspace (Bento Area) */}
            <div className="lg:col-span-9 overflow-y-auto custom-scrollbar bg-card/30 p-4 md:p-6">
              <ProductCustomizationOptions
                productId={productId}
                quantity={quantity}
                initialPersonalizations={existingPersonalizations.map(p => ({
                  locationCode: p.location_code ?? '',
                  locationName: p.location_name ?? '',
                  techniqueId: p.technique_id,
                  techniqueName: p.technique_name,
                  codigoTabela: '',
                  grupoTecnica: '',
                  width: p.width_cm ?? undefined,
                  height: p.height_cm ?? undefined,
                  numberOfColors: p.colors_count ?? 1,
                  usaDimensao: !!(p.width_cm && p.height_cm),
                  price: null,
                } as PersonalizationItem))}
                onSelectionChange={handleSelectionChange}
              />
            </div>
          </div>
        </div>

        <div className="p-4 border-t bg-muted/20 flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground max-w-[200px] leading-tight">
            As alterações são salvas automaticamente ao confirmar cada técnica.
          </p>
          <Button onClick={() => setIsOpen(false)} variant="default">
            Concluir Configuração
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
