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
import { ProductCustomizationOptions } from '@/components/products/ProductCustomizationOptions';
import type { QuoteItemPersonalization } from '@/hooks/quotes';
import type { PersonalizationItem, CustomizationPriceResponseV6 } from '@/types/customization';


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

  if (!productId) {
    return (
      <div className="py-4 text-center text-sm text-muted-foreground">
        Selecione um produto para ver as opções de personalização
      </div>
    );
  }

  const confirmed = existingPersonalizations;


  return (
    <div className="space-y-4">
      {/* 1) Configurador — auto-confirma ao calcular preço */}
      <ProductCustomizationOptions
        productId={productId}
        quantity={quantity}
        initialPersonalizations={existingPersonalizations.map((p) => ({
          locationCode: p.location_code || '',
          locationName: p.location_name || '',
          techniqueId: p.technique_id,
          techniqueName: p.technique_name || '',
          codigoTabela: '', // Not strictly needed for UI persistence if techniqueId matches
          grupoTecnica: '',
          width: p.width_cm,
          height: p.height_cm,
          numberOfColors: p.colors_count || 1,
          usaDimensao: !!(p.width_cm || p.height_cm),
          price: {
            success: true,
            preco_unitario: p.unit_cost || 0,
            valor_gravacao: (p.unit_cost || 0) * quantity,
            setup_total: p.setup_cost || 0,
            total_cobrado: p.total_cost || 0,
            nome_tabela: p.technique_name || '',
            quantidade: quantity,
            num_cores: p.colors_count || 1,
            faixa: { qtd_min: 0, qtd_max: 9999 }, // Placeholder
          } satisfies CustomizationPriceResponseV6,
        }))}
        onSelectionChange={handleSelectionChange}
      />

      {confirmed.length === 0 && (
        <p className="text-center text-[11px] text-muted-foreground/70">
          Configure a técnica acima — o preço será adicionado automaticamente ao orçamento.
        </p>
      )}
    </div>
  );
}
