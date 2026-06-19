import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useQuotes, type Quote } from '@/hooks/quotes/useQuotes';

import { logger } from '@/lib/logger';
export interface QuoteVersion {
  id: string;
  quote_number: string;
  version: number;
  status: string;
  total: number;
  subtotal: number;
  discount_amount: number;
  discount_percent: number;
  created_at: string;
  updated_at: string;
  is_latest_version: boolean;
  parent_quote_id: string | null;
  items_count?: number;
}

export function useQuoteVersions(quoteId?: string) {
  const { user } = useAuth();
  const { fetchQuote, createQuote, logQuoteHistory } = useQuotes();
  const [versions, setVersions] = useState<QuoteVersion[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchVersions = useCallback(
    async (targetQuoteId?: string) => {
      const id = targetQuoteId || quoteId;
      if (!id) return;

      setIsLoading(true);
      try {
        // First get the quote to find the root parent
        const { data: currentQuote, error: qErr } = await supabase
          // rls-allow: lookup por quote_id; RLS valida ownership
          .from('quotes')
          .select('id, parent_quote_id, version')
          .eq('id', id)
          .single();

        if (qErr || !currentQuote) throw qErr ?? new Error('Quote not found');

        // Find the root quote ID (the original quote)
        const rootId = currentQuote.parent_quote_id || currentQuote.id;

        // Get all versions: the root + all children
        const { data, error } = await supabase
          // rls-allow: lookup por quote_id; RLS valida ownership
          .from('quotes')
          .select(
            'id, quote_number, version, status, total, subtotal, discount_amount, discount_percent, created_at, updated_at, is_latest_version, parent_quote_id',
          )
          .or(`id.eq.${rootId},parent_quote_id.eq.${rootId}`)
          .order('version', { ascending: true });

        if (error) throw error;

        // Count items for each version
        const versionIds = (data || []).map((v) => v.id);
        const { data: itemCounts } = await supabase
          .from('quote_items')
          .select('quote_id')
          .in('quote_id', versionIds);

        const countMap = new Map<string, number>();
        (itemCounts || []).forEach((item) => {
          countMap.set(item.quote_id, (countMap.get(item.quote_id) || 0) + 1);
        });

        const versionsWithCounts: QuoteVersion[] = (data || []).map((v) => ({
          ...v,
          status: v.status ?? 'draft',
          total: v.total ?? 0,
          subtotal: v.subtotal ?? 0,
          discount_amount: v.discount_amount ?? 0,
          discount_percent: v.discount_percent ?? 0,
          created_at: v.created_at ?? '',
          updated_at: v.updated_at ?? '',
          items_count: countMap.get(v.id) || 0,
        }));

        setVersions(versionsWithCounts);
      } catch (err) {
        logger.error('Error fetching quote versions:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [quoteId],
  );

  const createNewVersion = useCallback(
    async (sourceQuoteId: string): Promise<Quote | null> => {
      if (!user) {
        toast.error('Usuário não autenticado');
        return null;
      }

      setIsLoading(true);
      try {
        const original = await fetchQuote(sourceQuoteId);
        if (!original) throw new Error('Orçamento não encontrado');

        // Get current version info
        const { data: currentData } = await supabase
          // rls-allow: lookup por quote_id; RLS valida ownership
          .from('quotes')
          .select('version, parent_quote_id')
          .eq('id', sourceQuoteId)
          .single();

        const rootId = currentData?.parent_quote_id || sourceQuoteId;
        const currentVersion = currentData?.version || 1;

        // Find max version across all versions of this quote
        const { data: maxVersionData } = await supabase
          // rls-allow: lookup por quote_id; RLS valida ownership
          .from('quotes')
          .select('version')
          .or(`id.eq.${rootId},parent_quote_id.eq.${rootId}`)
          .order('version', { ascending: false })
          .limit(1);

        const maxVersion = maxVersionData?.[0]?.version || currentVersion;
        const newVersion = maxVersion + 1;

        // Mark all existing versions as not latest
        await supabase
          // rls-allow: lookup por quote_id; RLS valida ownership
          .from('quotes')
          .update({ is_latest_version: false })
          .or(`id.eq.${rootId},parent_quote_id.eq.${rootId}`);

        // Create new version via duplicate
        const items =
          original.items?.map((item) => ({
            product_id: item.product_id,
            product_name: item.product_name,
            product_sku: item.product_sku,
            product_image_url: item.product_image_url,
            quantity: item.quantity,
            unit_price: item.unit_price,
            color_name: item.color_name,
            color_hex: item.color_hex,
            notes: item.notes,
            bitrix_product_id: item.bitrix_product_id,
            personalizations: item.personalizations?.map((p) => ({
              technique_id: p.technique_id,
              technique_name: p.technique_name,
              colors_count: p.colors_count,
              positions_count: p.positions_count,
              area_cm2: p.area_cm2,
              width_cm: p.width_cm,
              height_cm: p.height_cm,
              setup_cost: p.setup_cost,
              unit_cost: p.unit_cost,
              total_cost: p.total_cost,
              notes: p.notes,
            })),
          })) ?? [];

        const newQuote = await createQuote(
          {
            client_id: original.client_id,
            contact_id: original.contact_id,
            client_name: original.client_name,
            client_email: original.client_email,
            client_phone: original.client_phone,
            client_company: original.client_company,
            status: 'draft',
            discount_percent: original.discount_percent,
            discount_amount: original.discount_amount,
            notes: original.notes,
            payment_terms: original.payment_terms,
            delivery_time: original.delivery_time,
            shipping_type: original.shipping_type,
            shipping_cost: original.shipping_cost,
            internal_notes: original.internal_notes,
            valid_until: original.valid_until,
          },
          items,
        );

        if (newQuote?.id) {
          // Update the new quote with version info
          await supabase
            // rls-allow: lookup por quote_id; RLS valida ownership
            .from('quotes')
            .update({
              version: newVersion,
              parent_quote_id: rootId,
              is_latest_version: true,
            })
            .eq('id', newQuote.id);

          await logQuoteHistory(
            newQuote.id,
            'version_created',
            `Versão ${newVersion} criada a partir de ${original.quote_number} (v${currentVersion})`,
          );

          toast.success(`Versão ${newVersion} criada!`, {
            description: `Baseada em ${original.quote_number} v${currentVersion}`,
          });

          await fetchVersions(rootId);
        }

        return newQuote;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao criar versão';
        toast.error('Erro ao criar nova versão', { description: message });
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [user, fetchQuote, createQuote, logQuoteHistory, fetchVersions],
  );

  return {
    versions,
    isLoading,
    fetchVersions,
    createNewVersion,
    hasMultipleVersions: versions.length > 1,
  };
}
