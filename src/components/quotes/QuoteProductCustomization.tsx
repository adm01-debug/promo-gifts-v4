/**
 * QuoteProductCustomization — Personalização de produto dentro do orçamento
 * 
 * ESTRATÉGIA: Interface limpa que delega a complexidade para o ProductCustomizationModal.
 * Reduz a carga cognitiva mantendo apenas o resumo das gravações visível.
 */

import { useCallback } from "react";
import { CheckCircle2, Trash2, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductCustomizationModal } from "@/components/products/ProductCustomizationModal";
import type { QuoteItemPersonalization } from "@/hooks/useQuotes";

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface QuoteProductCustomizationProps {
  productId: string;
  productName?: string;
  quantity: number;
  existingPersonalizations?: QuoteItemPersonalization[];
  onPersonalizationsChange: (personalizations: QuoteItemPersonalization[]) => void;
}

export function QuoteProductCustomization({
  productId,
  productName,
  quantity,
  existingPersonalizations = [],
  onPersonalizationsChange,
}: QuoteProductCustomizationProps) {
  const handleRemove = useCallback((idx: number) => {
    const updated = existingPersonalizations.filter((_, i) => i !== idx);
    onPersonalizationsChange(updated);
  }, [existingPersonalizations, onPersonalizationsChange]);

  if (!productId) {
    return (
      <div className="text-center py-4 text-muted-foreground text-sm border-t border-dashed mt-4">
        Selecione um produto para habilitar a personalização
      </div>
    );
  }

  const confirmed = existingPersonalizations;
  const confirmedTotal = confirmed.reduce((s, p) => s + (p.total_cost || 0), 0);

  return (
    <div className="space-y-4 pt-4 border-t border-border/60">
      {/* 1) Trigger do Modal — Onde a mágica acontece de forma isolada */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="space-y-0.5">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Palette className="h-3 w-3" />
              Configuração de Gravação
            </h4>
            <p className="text-[10px] text-muted-foreground">
              Técnicas, locais e dimensões da arte
            </p>
          </div>
          
          {confirmed.length > 0 && (
            <Badge variant="outline" className="text-primary border-primary/20 bg-primary/5 px-2 py-0 h-5">
              {fmt(confirmedTotal)}
            </Badge>
          )}
        </div>

        <ProductCustomizationModal
          productId={productId}
          productName={productName}
          quantity={quantity}
          existingPersonalizations={existingPersonalizations}
          onPersonalizationsChange={onPersonalizationsChange}
        />
      </div>

      {/* 2) Resumo das Gravações — Visão limpa das escolhas */}
      {confirmed.length > 0 && (
        <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-300">
          <p className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground/70 px-1">
            Resumo do Orçamento
          </p>
          <div className="grid gap-1.5">
            {confirmed.map((p, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-2 p-2 rounded-lg bg-secondary/30 border border-border/40 hover:border-primary/20 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-3 w-3 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-foreground block truncate">
                      {p.location_name} — {p.technique_name}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {p.width_cm && p.height_cm ? `${p.width_cm}×${p.height_cm}cm · ` : ""}
                      {p.colors_count || 1} cor{(p.colors_count || 1) > 1 ? "es" : ""}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] font-bold text-foreground">
                    {fmt(p.total_cost || 0)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Excluir"
                    className="h-6 w-6 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleRemove(i)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
