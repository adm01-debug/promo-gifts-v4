/**
 * useKitBuilderQuote — Lógica de criação de orçamento a partir do kit
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { calculateTotalKitPrice, type KitState, type KitItem } from '@/lib/kit-builder';
import type { TablesInsert } from '@/integrations/supabase/types';

export function useKitBuilderQuote() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isCreatingQuote, setIsCreatingQuote] = useState(false);

  const handleAddToQuote = async (kitState: KitState, kitQuantity: number) => {
    if (!user) {
      toast.error('Você precisa estar logado para criar um orçamento.');
      return;
    }

    if (!kitState.isValid) return;

    setIsCreatingQuote(true);
    try {
      const kitLabel = kitState.name || 'Kit sem nome';
      const kitMetadataNote = kitState.identity?.tag
        ? `[${kitState.identity.tag}] ${kitLabel}`
        : kitLabel;

      const boxRef = kitState.box;
      const itemsRef = kitState.items;
      const personRef = kitState.personalization;
      const pricing = calculateTotalKitPrice(boxRef, itemsRef, personRef, kitQuantity);
      const quotePayload = {
        seller_id: user.id,
        status: 'draft',
        // Empty string lets the `set_quote_number` BEFORE INSERT trigger generate it.
        quote_number: '',
        client_name: 'Sem cliente',
        subtotal: pricing.subtotal,
        discount_percent: 0,
        discount_amount: 0,
        total: pricing.total,
        negotiation_markup_percent: 0,
        notes: `Kit: ${kitMetadataNote}`,
        // internal_notes removido: campo descontinuado na UI.
        tags: {
          source: 'kit-builder',
          kit_name: kitLabel,
          kit_quantity: kitQuantity,
          kit_identity_tag: kitState.identity?.tag ?? null,
        },
      } satisfies TablesInsert<'quotes'>;

      // Create quote
      const { data: quote, error: quoteError } = await supabase
        // rls-allow: insert cria orçamento do usuário atual; RLS valida seller_id
        .from('quotes')
        .insert(quotePayload)
        .select('id')
        .single();

      if (quoteError) throw quoteError;
      if (!quote) throw new Error('Failed to create quote');

      const kitGroupId = crypto.randomUUID();
      const quoteItems: TablesInsert<'quote_items'>[] = [];

      // Add box if present
      if (boxRef) {
        const boxQty = kitQuantity;
        quoteItems.push({
          quote_id: quote.id,
          product_name: boxRef.name,
          product_sku: boxRef.sku || null,
          product_image_url: boxRef.imageUrl || null,
          product_id: boxRef.id,
          quantity: boxQty,
          unit_price: boxRef.price,
          subtotal: boxRef.price * boxQty,
          sort_order: 0,
          notes: 'Caixa/embalagem do kit',
          color_name: null,
          color_hex: null,
          kit_group_id: kitGroupId,
          kit_name: kitLabel,
        });
      }

      itemsRef.forEach((item: KitItem, index: number) => {
        const itemQty = item.quantity * kitQuantity;
        quoteItems.push({
          quote_id: quote.id,
          product_name: item.name,
          product_sku: item.sku || null,
          product_image_url: item.imageUrl || null,
          product_id: item.id,
          quantity: itemQty,
          unit_price: item.price,
          subtotal: item.price * itemQty,
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
          const personalizations: TablesInsert<'quote_item_personalizations'>[] = [];

          if (personRef.box.enabled && boxRef) {
            const boxId = boxRef.id;
            const boxQuoteItem = insertedItems.find((i) => i.product_id === boxId);
            if (boxQuoteItem) {
              const bp = personRef.box;
              personalizations.push({
                quote_item_id: boxQuoteItem.id,
                technique_name: bp.techniqueName || null,
                colors_count: bp.colors || undefined,
                width_cm: bp.width || null,
                height_cm: bp.height || null,
                unit_cost: bp.estimatedPrice || undefined,
                total_cost: bp.estimatedPrice ? bp.estimatedPrice * kitQuantity : undefined,
                setup_cost: undefined,
                personalized_quantity: kitQuantity,
                notes: bp.position ? `Posição: ${bp.position}` : null,
              });
            }
          }

          itemsRef.forEach((item: KitItem) => {
            const itemP = personRef.items[item.id];
            if (itemP?.enabled) {
              const itemQuoteItem = insertedItems.find((i) => i.product_id === item.id);
              if (itemQuoteItem) {
                const totalQty = item.quantity * kitQuantity;
                personalizations.push({
                  quote_item_id: itemQuoteItem.id,
                  technique_name: itemP.techniqueName || null,
                  colors_count: itemP.colors || undefined,
                  width_cm: itemP.width || null,
                  height_cm: itemP.height || null,
                  unit_cost: itemP.estimatedPrice || undefined,
                  total_cost: itemP.estimatedPrice ? itemP.estimatedPrice * totalQty : undefined,
                  setup_cost: undefined,
                  personalized_quantity: totalQty,
                  notes: itemP.position ? `Posição: ${itemP.position}` : null,
                });
              }
            }
          });

          if (personalizations.length > 0) {
            const { error: personError } = await supabase
              .from('quote_item_personalizations')
              .insert(personalizations);
            if (personError) {
              logger.warn('[Kit Quote] Failed to insert personalizations:', personError);
            }
          }
        }
      }

      toast.success(`Orçamento criado com sucesso!`);
      navigate(`/orcamentos/${quote.id}`);
    } catch (err) {
      logger.error('[Kit Quote] Error creating quote:', err);
      toast.error('Erro ao criar orçamento. Tente novamente.');
    } finally {
      setIsCreatingQuote(false);
    }
  };

  return { handleAddToQuote, isCreatingQuote };
}
