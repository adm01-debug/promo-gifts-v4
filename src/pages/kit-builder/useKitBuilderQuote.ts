/**
 * useKitBuilderQuote — Lógica de criação de orçamento a partir do kit
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import type { KitState } from '@/hooks/kit-builder';

export function useKitBuilderQuote() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isCreatingQuote, setIsCreatingQuote] = useState(false);

  const handleAddToQuote = async (kitState: KitState, kitQuantity: number) => {
    if (!user?.id) {
      toast.error('Você precisa estar logado para criar um orçamento.');
      return;
    }
    if (!kitState.isValid) return;

    setIsCreatingQuote(true);
    try {
      const kitLabel = kitState.name || 'Kit sem nome';
      const kitGroupId = crypto.randomUUID();
      const kitMetadataNote = kitState.identity?.tag
        ? `[${kitState.identity.tag}] ${kitLabel}`
        : kitLabel;

      const { calculateTotalKitPrice } = await import('@/lib/kit-builder');
      const { total: kitTotal } = calculateTotalKitPrice(
        kitState.box,
        kitState.items,
        kitState.personalization,
        kitQuantity,
      );

      // Create quote
      const { data: quote, error: quoteError } = await supabase
        // rls-allow: INSERT inclui seller_id no payload
        .from('quotes')
        .insert({
          seller_id: user.id,
          status: 'draft',
          subtotal: kitTotal,
          total: kitTotal,
          notes: `Kit "${kitMetadataNote}" (${kitQuantity}x) — tipo: ${kitState.kitType}`,
          internal_notes:
            [
              kitState.box
                ? `Caixa: ${kitState.box.name} | Volume: ${kitState.volumeUsagePercent.toFixed(0)}%`
                : null,
              kitState.identity?.color || kitState.identity?.icon || kitState.identity?.tag
                ? `Identidade: cor=${kitState.identity?.color ?? '-'} | ícone=${kitState.identity?.icon ?? '-'} | tag=${kitState.identity?.tag ?? '-'}`
                : null,
            ]
              .filter(Boolean)
              .join('\n') || undefined,
        })
        .select('id, quote_number')
        .single();

      if (quoteError) throw quoteError;

      // Build items
      const quoteItems: Array<Record<string, unknown>> = [];

      if (kitState.box) {
        quoteItems.push({
          quote_id: quote.id,
          product_name: `[Embalagem] ${kitState.box.name}`,
          product_sku: kitState.box.sku || null,
          product_image_url: kitState.box.imageUrl || null,
          product_id: kitState.box.id,
          quantity: kitQuantity,
          unit_price: kitState.box.price,
          sort_order: 0,
          notes: `Dimensões internas: ${kitState.box.internalWidth}×${kitState.box.internalHeight}×${kitState.box.internalDepth}cm`,
          color_name: null,
          color_hex: null,
          kit_group_id: kitGroupId,
          kit_name: kitLabel,
        });
      }

      kitState.items.forEach((item, index) => {
        quoteItems.push({
          quote_id: quote.id,
          product_name: item.name,
          product_sku: item.sku || null,
          product_image_url: item.imageUrl || null,
          product_id: item.id,
          quantity: item.quantity * kitQuantity,
          unit_price: item.price,
          sort_order: index + 1,
          notes: item.isOptional ? 'Item opcional' : null,
          color_name: item.selectedColor?.name || null,
          color_hex: item.selectedColor?.hex || null,
          kit_group_id: kitGroupId,
          kit_name: kitLabel,
        });
      });

      if (quoteItems.length > 0) {
        const { data: insertedItems, error: itemsError } = await supabase
          .from('quote_items')
          .insert(quoteItems)
          .select('id, product_id');
        if (itemsError) throw itemsError;

        // Personalizations
        if (insertedItems) {
          const personalizations: Array<Record<string, unknown>> = [];

          if (kitState.personalization.box.enabled && kitState.box) {
            const boxId = kitState.box.id;
            const boxQuoteItem = insertedItems.find((i) => i.product_id === boxId);
            if (boxQuoteItem) {
              const bp = kitState.personalization.box;
              personalizations.push({
                quote_item_id: boxQuoteItem.id,
                technique_name: bp.techniqueName || null,
                colors_count: bp.colors || null,
                width_cm: bp.width || null,
                height_cm: bp.height || null,
                unit_cost: bp.estimatedPrice || null,
                total_cost: bp.estimatedPrice ? bp.estimatedPrice * kitQuantity : null,
                setup_cost: null,
                personalized_quantity: kitQuantity,
                notes: bp.position ? `Posição: ${bp.position}` : null,
              });
            }
          }

          kitState.items.forEach((item) => {
            const itemP = kitState.personalization.items[item.id];
            if (itemP?.enabled) {
              const itemQuoteItem = insertedItems.find((i) => i.product_id === item.id);
              if (itemQuoteItem) {
                const totalQty = item.quantity * kitQuantity;
                personalizations.push({
                  quote_item_id: itemQuoteItem.id,
                  technique_name: itemP.techniqueName || null,
                  colors_count: itemP.colors || null,
                  width_cm: itemP.width || null,
                  height_cm: itemP.height || null,
                  unit_cost: itemP.estimatedPrice || null,
                  total_cost: itemP.estimatedPrice ? itemP.estimatedPrice * totalQty : null,
                  setup_cost: null,
                  personalized_quantity: totalQty,
                  notes: itemP.position ? `Posição: ${itemP.position}` : null,
                });
              }
            }
          });

          if (personalizations.length > 0) {
            const { error: persError } = await supabase
              .from('quote_item_personalizations')
              .insert(personalizations);
            if (persError) logger.warn('Erro ao salvar personalizações:', persError);
          }
        }
      }

      toast.success(`Orçamento ${quote.quote_number} criado!`, {
        description: `${quoteItems.length} itens adicionados ao kit "${kitLabel}".`,
        action: {
          label: 'Ver orçamento',
          onClick: () => navigate(`/orcamentos/${quote.id}`),
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error(`Erro ao criar orçamento: ${message}`);
    } finally {
      setIsCreatingQuote(false);
    }
  };

  return { handleAddToQuote, isCreatingQuote };
}
