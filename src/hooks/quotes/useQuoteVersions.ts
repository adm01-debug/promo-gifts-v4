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

        // Find the root quote ID (the original quote).
        // Guard against self-referencing parent_quote_id (data corruption) which would
        // cause the OR query to return the same row twice, corrupting the version tree.
        const _parentId = currentQuote.parent_quote_id;
        const rootId =
          _parentId !== null && _parentId !== currentQuote.id ? _parentId : currentQuote.id;

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
        // BUG-QUOTEVERSIONS-ITEMCOUNTS-SELECT-SILENT-FAIL FIX: { data: itemCounts } without
        // error check — RLS failure silently showed items_count=0 on all versions.
        // Secondary fetch: primary versions query already succeeded; log.warn and degrade.
        const { data: itemCounts, error: itemCountsErr } = await supabase
          .from('quote_items')
          .select('quote_id')
          .in('quote_id', versionIds);
        if (itemCountsErr) logger.warn('Failed to fetch item counts for versions:', itemCountsErr);

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
        // BUG-VERSION-CTX-SILENT-FAIL FIX: previously { error } was not destructured.
        // A failed lookup silently left currentVersion=1 and rootId=sourceQuoteId,
        // risking duplicate version numbers if another version already had those values.
        const { data: currentData, error: versionCtxErr } = await supabase
          // rls-allow: lookup por quote_id; RLS valida ownership
          .from('quotes')
          .select('version, parent_quote_id')
          .eq('id', sourceQuoteId)
          .single();
        if (versionCtxErr) logger.warn('Failed to fetch version context, defaulting:', versionCtxErr);

        const _parentId2 = currentData?.parent_quote_id ?? null;
        const rootId =
          _parentId2 !== null && _parentId2 !== sourceQuoteId ? _parentId2 : sourceQuoteId;
        const currentVersion = currentData?.version ?? 1;

        // Find max version across all versions of this quote
        // BUG-VERSION-MAX-SILENT-FAIL FIX: previously { error } was not destructured.
        // A failed query silently defaulted maxVersion=currentVersion, risking duplicate
        // version numbers when the actual max in the DB was higher.
        const { data: maxVersionData, error: maxVersionErr } = await supabase
          // rls-allow: lookup por quote_id; RLS valida ownership
          .from('quotes')
          .select('version')
          .or(`id.eq.${rootId},parent_quote_id.eq.${rootId}`)
          .order('version', { ascending: false })
          .limit(1);
        if (maxVersionErr) logger.warn('Failed to fetch max version, defaulting to currentVersion:', maxVersionErr);

        // BUG-033: use ?? not || so version=0 (impossible but defensive) doesn't
        // fall back to currentVersion and produce a duplicate version number.
        const maxVersion = maxVersionData?.[0]?.version ?? currentVersion;
        const newVersion = maxVersion + 1;

        // Mark all existing versions as not latest
        // BUG-VERSION-SILENT-FAIL FIX: silent failure here leaves the old version
        // with is_latest_version=true and the new one also marked true, corrupting
        // the version tree. Log and throw so createNewVersion rolls back cleanly.
        const { error: clearErr } = await supabase
          // rls-allow: lookup por quote_id; RLS valida ownership
          .from('quotes')
          .update({ is_latest_version: false })
          .or(`id.eq.${rootId},parent_quote_id.eq.${rootId}`);
        if (clearErr) {
          logger.error('Failed to clear is_latest_version on prior versions:', clearErr);
          throw clearErr;
        }

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
            client_cnpj: original.client_cnpj ?? undefined,
            status: 'draft',
            discount_percent: original.discount_percent,
            discount_amount: original.discount_amount,
            negotiation_markup_percent: original.negotiation_markup_percent ?? 0,
            notes: original.notes,
            payment_method: original.payment_method,
            payment_terms: original.payment_terms,
            delivery_time: original.delivery_time,
            shipping_type: original.shipping_type,
            shipping_cost: original.shipping_cost,
            // internal_notes removido: campo descontinuado (apenas notes vai na proposta).
            valid_until: original.valid_until,
          },
          items,
        );

        if (newQuote?.id) {
          // Update the new quote with version info
          // BUG-VERSION-SILENT-FAIL FIX: silent failure here leaves the new quote
          // without a version number or parent link — the version tree is broken.
          const { error: versionErr } = await supabase
            // rls-allow: lookup por quote_id; RLS valida ownership
            .from('quotes')
            .update({
              version: newVersion,
              parent_quote_id: rootId,
              is_latest_version: true,
            })
            .eq('id', newQuote.id);
          if (versionErr) logger.error('Failed to set version metadata on new quote:', versionErr);

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
