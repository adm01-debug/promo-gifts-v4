import { dbInvoke } from '@/lib/db/postgrest';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import type { Quote, QuoteItem, PersonalizationTechnique } from '@/hooks/quotes/quoteTypes';
import {
  calculateQuoteTotals,
  buildInsertPayload,
  buildUpdatePayload,
  buildItemsInsertPayload,
  buildPersonalizationsInsertPayload,
  round2,
} from '@/hooks/quotes/quoteHelpers';
import { sanitizeMessage } from '@/lib/security/sanitize-message';

import { logger } from '@/lib/logger';
export const quoteService = {
  async fetchQuotes(userId: string, scope: string) {
    let query = supabase
      // rls-allow: escopo aplicado condicionalmente abaixo (self → seller_id; admin scope=all sem filtro); RLS reforça
      .from('quotes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    // Apply seller scope logic
    if (scope === 'self') {
      query = query.eq('seller_id', userId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as Quote[];
  },

  async fetchQuote(quoteId: string): Promise<Quote | null> {
    // Both queries depend only on quoteId — run in parallel.
    const [{ data: quoteData, error: qErr }, { data: itemsData, error: iErr }] = await Promise.all([
      supabase
        // rls-allow: lookup por id; RLS (can_access_quote) valida ownership
        .from('quotes')
        .select('*')
        .eq('id', quoteId)
        .single(),
      supabase
        .from('quote_items')
        .select('*')
        .eq('quote_id', quoteId)
        .order('sort_order', { ascending: true }),
    ]);

    if (qErr) throw qErr;
    if (iErr) throw iErr;
    if (!quoteData) return null;

    const itemIds = (itemsData ?? []).map((i) => i.id);
    let allPersonalizations: Array<Record<string, unknown>> = [];
    if (itemIds.length > 0) {
      const { data: persData, error: pErr } = await supabase
        .from('quote_item_personalizations')
        .select('*')
        .in('quote_item_id', itemIds);
      if (pErr) throw pErr;
      allPersonalizations = persData ?? [];
    }

    // DB rows are a superset of QuoteItem and carry a runtime-only `personalizations`
    // array; assert to the curated QuoteItem shape.
    const items = (itemsData ?? []).map((item) => ({
      ...item,
      personalizations: allPersonalizations.filter((p) => p.quote_item_id === item.id),
    })) as unknown as QuoteItem[];

    return { ...quoteData, items } as Quote;
  },

  async createQuote(
    quote: Partial<Quote>,
    items: QuoteItem[],
    userId: string,
    orgId: string | null,
  ): Promise<Quote> {
    const totals = calculateQuoteTotals(quote, items);
    const insertPayload = buildInsertPayload(quote, userId, orgId, totals);

    const { data: inserted, error: insErr } = await supabase
      // rls-allow: INSERT define seller_id no payload (buildInsertPayload com userId); RLS valida
      .from('quotes')
      .insert(insertPayload)
      .select('*')
      .single();

    if (insErr) throw insErr;
    if (!inserted) throw new Error('Falha ao inserir orçamento');

    await this.insertItemsWithPersonalizations(items, inserted.id);

    return { ...inserted, items } as unknown as Quote;
  },

  async updateQuote(quoteId: string, quote: Partial<Quote>, items: QuoteItem[]): Promise<Quote> {
    const totals = calculateQuoteTotals(quote, items);
    const updatePayload = buildUpdatePayload(quote, totals);
    const itemsPayload = buildItemsInsertPayload(items, quoteId).map((item, index) => ({
      ...item,
      product_name: item.product_name?.trim().slice(0, 255),
      unit_price: round2(item.unit_price),
      notes: item.notes?.trim().slice(0, 1000),
      personalizations: buildPersonalizationsInsertPayload(
        items[index]?.personalizations ?? [],
        quoteId,
      ),
    }));

    const { data: updated, error } = await supabase.rpc(
      'update_quote_transactional' as never,
      {
        _quote_id: quoteId,
        _quote_patch: updatePayload,
        _items: itemsPayload,
      } as never,
    );

    if (error) {
      const message = sanitizeMessage(error, {
        fallback: 'Não foi possível atualizar o orçamento. Tente novamente.',
      });
      throw new Error(message);
    }

    if (!updated) {
      throw new Error('Não foi possível atualizar o orçamento: nenhum dado retornado.');
    }

    return { ...(updated as Quote), items };
  },

  async insertItemsWithPersonalizations(items: QuoteItem[], quoteId: string) {
    if (items.length === 0) return;

    const itemsPayload = buildItemsInsertPayload(items, quoteId).map((item) => ({
      ...item,
      product_name: item.product_name?.trim().slice(0, 255),
      unit_price: round2(item.unit_price),
      notes: item.notes?.trim().slice(0, 1000),
    }));

    const { data: insertedItems, error: itemsErr } = await supabase
      .from('quote_items')
      .insert(itemsPayload)
      .select('*');

    if (itemsErr) throw itemsErr;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const insertedItem = insertedItems?.[i];
      if (item.personalizations?.length && insertedItem) {
        const persPayload = buildPersonalizationsInsertPayload(
          item.personalizations,
          insertedItem.id,
        );
        const { error } = await supabase.from('quote_item_personalizations').insert(persPayload);

        if (error) {
          throw Object.assign(error, {
            context: {
              quoteId,
              quoteItemId: insertedItem.id,
              personalizationsCount: persPayload.length,
            },
            message: `Falha ao inserir personalizações do item ${insertedItem.id} no orçamento ${quoteId}: ${error.message}`,
          });
        }
      }
    }
  },

  async updateQuoteStatus(quoteId: string, status: Quote['status']) {
    // rls-allow: UPDATE de status por id; RLS (can_access_quote) valida ownership
    const { error } = await supabase.from('quotes').update({ status }).eq('id', quoteId);
    if (error) throw error;
  },

  async deleteQuote(quoteId: string) {
    // rls-allow: DELETE por id; RLS (can_access_quote) valida ownership
    const { error } = await supabase.from('quotes').delete().eq('id', quoteId);
    if (error) throw error;
  },

  async fetchTechniques(): Promise<PersonalizationTechnique[]> {
    const result = await dbInvoke<PersonalizationTechnique>({
      table: 'personalization_techniques',
      operation: 'select',
      filters: { is_active: true },
      orderBy: { column: 'name', ascending: true },
      limit: 100,
    });
    return result.records ?? [];
  },

  async logHistory(
    quoteId: string,
    userId: string,
    action: string,
    description: string,
    options?: Record<string, unknown>,
  ) {
    const { error } = await supabase.from('quote_history').insert({
      quote_id: quoteId,
      user_id: userId,
      action,
      description,
      field_changed: typeof options?.fieldChanged === 'string' ? options.fieldChanged : null,
      old_value: typeof options?.oldValue === 'string' ? options.oldValue : null,
      new_value: typeof options?.newValue === 'string' ? options.newValue : null,
      metadata: (options?.metadata ?? {}) as Json,
    });

    if (error) {
      logger.error('[quoteService.logHistory] Failed to log history:', error);
      // We don't necessarily want to crash the whole operation if history logging fails,
      // but we should at least log it. Other service methods throw errors.
      // throw error;
    }
  },
};
