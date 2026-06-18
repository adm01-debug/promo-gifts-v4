/**
 * QuoteProductCustomization — Personalização de produto dentro do orçamento
 *
 * Usa ProductCustomizationOptions v6 com o novo fluxo:
 * Local → Técnica → Dimensões/Cores → Preço → AUTO-CONFIRMA
 *
 * A personalização é confirmada automaticamente quando o preço é calculado,
 * sem necessidade de clicar em "Adicionar" — evitando perda de dados.
 */

import { useCallback, useEffect, useRef } from 'react';
import { CheckCircle2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProductCustomizationOptions } from '@/components/products/ProductCustomizationOptions';
import type { QuoteItemPersonalization } from '@/hooks/quotes';
import type { PersonalizationItem, CustomizationPriceResponseV6 } from '@/types/customization';

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface QuoteProductCustomizationProps {
  productId: string;
  quantity: number;
  existingPersonalizations?: QuoteItemPersonalization[];
  onPersonalizationsChange: (personalizations: QuoteItemPersonalization[]) => void;
}

export function QuoteProductCustomization({
  productId,
  quantity,
  existingPersonalizations = [],
  onPersonalizationsChange,
}: QuoteProductCustomizationProps) {
  // Use ref to hold current personalizations to avoid stale closures
  const personalizationsRef = useRef<QuoteItemPersonalization[]>(existingPersonalizations);

  // Keep ref in sync if parent changes existingPersonalizations (e.g. on load)
  useEffect(() => {
    personalizationsRef.current = existingPersonalizations;
  }, [existingPersonalizations]);

  // Auto-confirm: whenever a price is calculated, update the personalization map immediately
  const handleSelectionChange = useCallback(
    (items: PersonalizationItem[]) => {
      const updated = [...personalizationsRef.current];

      items.forEach((item) => {
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
          notes:
            item.width && item.height
              ? `${item.locationName} — ${item.codigoTabela} | ${item.width}×${item.height}cm`
              : `${item.locationName} — ${item.codigoTabela}`,
        };

        // Replace existing by same locationCode
        const existingIdx = updated.findIndex((m) => m.location_code === newP.location_code);
        if (existingIdx >= 0) {
          updated[existingIdx] = newP;
        } else {
          updated.push(newP);
        }
      });

      personalizationsRef.current = updated;
      onPersonalizationsChange(updated);
    },
    [quantity, onPersonalizationsChange],
  );

  const handleRemove = useCallback(
    (idx: number) => {
      const updated = personalizationsRef.current.filter((_, i) => i !== idx);
      personalizationsRef.current = updated;
      onPersonalizationsChange(updated);
    },
    [onPersonalizationsChange],
  );

  if (!productId) {
    return (
      <div className="py-4 text-center text-sm text-muted-foreground">
        Selecione um produto para ver as opções de personalização
      </div>
    );
  }

  const confirmed = existingPersonalizations;
  const confirmedTotal = confirmed.reduce((s, p) => s + (p.total_cost ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* 1) Configurador — auto-confirma ao calcular preço */}
      <ProductCustomizationOptions
        productId={productId}
        quantity={quantity}
        initialPersonalizations={existingPersonalizations.map((p) => ({
          locationCode: p.location_code ?? '',
          locationName: p.location_name ?? '',
          techniqueId: p.technique_id,
          techniqueName: p.technique_name ?? '',
          codigoTabela: '', // Not strictly needed for UI persistence if techniqueId matches
          grupoTecnica: '',
          width: p.width_cm,
          height: p.height_cm,
          numberOfColors: p.colors_count || 1,
          usaDimensao: !!(p.width_cm || p.height_cm),
          price: {
            success: true,
            preco_unitario: p.unit_cost ?? 0,
            valor_gravacao: (p.unit_cost ?? 0) * quantity,
            setup_total: p.setup_cost ?? 0,
            total_cobrado: p.total_cost ?? 0,
            nome_tabela: p.technique_name ?? '',
            quantidade: quantity,
            num_cores: p.colors_count || 1,
            faixa: { qtd_min: 0, qtd_max: 9999 }, // Placeholder
          } satisfies CustomizationPriceResponseV6,
        }))}
        onSelectionChange={handleSelectionChange}
      />

      {/* 2) Gravações já confirmadas (aparecem ABAIXO, como resultado do passo) */}
      {confirmed.length > 0 ? (
        <div className="space-y-1.5 rounded-xl border border-primary/20 bg-primary/5 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wide text-primary">
              ✓ Gravações no orçamento
            </p>
            <Badge variant="secondary" className="text-[10px]">
              {confirmed.length} aplicada{confirmed.length !== 1 ? 's' : ''}
            </Badge>
          </div>
          {confirmed.map((p, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-background/60 p-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                <div className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-foreground">
                    {p.technique_name}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {p.width_cm && p.height_cm ? `${p.width_cm}×${p.height_cm}cm · ` : ''}
                    {p.colors_count || 1} cor{(p.colors_count || 1) > 1 ? 'es' : ''}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="secondary" className="text-xs font-semibold">
                  {fmt(p.total_cost ?? 0)}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Excluir"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemove(i)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
          <div className="mt-1 flex justify-between border-t border-primary/15 px-1 pt-1 text-xs">
            <span className="text-muted-foreground">Total gravação:</span>
            <span className="font-bold text-primary">{fmt(confirmedTotal)}</span>
          </div>
        </div>
      ) : (
        <p className="text-center text-[11px] text-muted-foreground/70">
          Configure a técnica acima — o preço será adicionado automaticamente ao orçamento.
        </p>
      )}
    </div>
  );
}
