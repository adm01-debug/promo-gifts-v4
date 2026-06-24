import { dbInvoke } from '@/lib/db/postgrest';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import {
  type Quote,
  type QuoteItem,
  type PersonalizationTechnique,
} from '@/hooks/quotes/quoteTypes';
import {
  calculateQuoteTotals,
  buildInsertPayload,
  buildUpdatePayload,
  buildItemsInsertPayload,
  buildPersonalizationsInsertPayload,
  round2,
} from '@/hooks/quotes/quoteHelpers';
import { sanitizeMessage } from '@/lib/security/sanitize-message';
import {
  QUOTE_STATUS_CONFIG,
  isValidQuoteTransition,
} from '@/lib/quote-status-config';
import type { QuoteStatus } from '@/types/quote';
import { sendTransactionalEmail, type EmailEventType } from '@/hooks/common/useTransactionalEmail';

import { logger } from '@/lib/logger';

const EMAIL_STATUS_MAP: Partial<Record<QuoteStatus, EmailEventType>> = {
  sent: 'quote_sent',
  approved: 'quote_approved',
  rejected: 'quote_rejected',
};
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

    const itemIds = (itemsData || []).map((i) => i.id);
    let allPersonalizations: Array<Record<string, unknown>> = [];
    if (itemIds.length > 0) {
      const { data: persData, error: pErr } = await supabase
        .from('quote_item_personalizations')
        .select('*')
        .in('quote_item_id', itemIds);
      if (pErr) throw pErr;
      allPersonalizations = persData || [];
    }

    // DB rows are a superset of QuoteItem and carry a runtime-only `personalizations`
    // array; assert to the curated QuoteItem shape.
    const items = (itemsData || []).map((item) => ({
      ...item,
      personalizations: allPersonalizations.filter((p) => p.quote_item_id === item.id),
    })) as unknown as QuoteItem[];

    // Hidratação runtime-only de categoria (não persistida em quote_items): batch
    // lookup por product_id para alimentar "Agrupar por categoria" no Resumo.
    const productIds = Array.from(
      new Set(items.map((i) => i.product_id).filter((v): v is string => !!v)),
    );
    if (productIds.length > 0) {
      try {
        const { data: prodCats } = await supabase
          .from('products')
          .select('id, category_id, category_name')
          .in('id', productIds);
        if (prodCats) {
          const catById = new Map(
            prodCats.map((p) => [
              p.id as string,
              {
                cid: (p as { category_id?: string | null }).category_id ?? null,
                cname: (p as { category_name?: string | null }).category_name ?? null,
              },
            ]),
          );
          for (const it of items) {
            if (!it.product_id) continue;
            const c = catById.get(it.product_id);
            if (c) {
              it.product_category_id = c.cid;
              it.product_category_name = c.cname;
            }
          }
        }
      } catch (err) {
        logger.warn('[quoteService.fetchQuote] category hydration failed', err);
      }
    }

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
    const itemsPayload = buildItemsInsertPayload(items, '').map((item, index) => ({
      ...item,
      product_name: item.product_name?.trim().slice(0, 255),
      unit_price: round2(item.unit_price),
      notes: item.notes?.trim().slice(0, 1000),
      personalizations: buildPersonalizationsInsertPayload(
        items[index]?.personalizations ?? [],
        '',
      ),
    }));

    const { data: created, error } = await supabase.rpc(
      'create_quote_transactional' as never,
      {
        _quote: insertPayload,
        _items: itemsPayload,
      } as never,
    );

    if (error) {
      const message = sanitizeMessage(error, {
        fallback: 'Não foi possível criar o orçamento. Tente novamente.',
      });
      throw new Error(message);
    }

    if (!created) {
      throw new Error('Não foi possível criar o orçamento: nenhum dado retornado.');
    }

    return { ...(created as Quote), items } as Quote;
  },

  /**
   * QBP-08 FIX (2026-06-22): Adicionado parâmetro `expectedVersion` para ativar
   * o optimistic lock server-side em `update_quote_transactional`.
   *
   * PROBLEMA ORIGINAL: `_expected_version` nunca era passado (sempre NULL).
   * A RPC tem lógica completa de detecção de conflito por versão, mas estava inativa.
   * O lock app-level (updated_at comparison) é suficiente para UX, mas o lock
   * server-side garante atomicidade no banco mesmo em race conditions não detectados
   * pelo app (ex: dois tabs simultâneos sem shared state).
   *
   * NOTA: expectedVersion é opcional (compatibilidade retroativa). Quando NULL,
   * o comportamento da RPC é idêntico ao anterior (sem lock server-side).
   */
  async updateQuote(
    quoteId: string,
    quote: Partial<Quote>,
    items: QuoteItem[],
    expectedVersion?: number | null,
  ): Promise<Quote> {
    const totals = calculateQuoteTotals(quote, items);
    const updatePayload = buildUpdatePayload(quote, totals);
    const itemsPayload = buildItemsInsertPayload(items, quoteId).map((item, index) => ({
      ...item,
      product_name: item.product_name?.trim().slice(0, 255),
      unit_price: round2(item.unit_price),
      notes: item.notes?.trim().slice(0, 1000),
      personalizations: buildPersonalizationsInsertPayload(
        items[index]?.personalizations ?? [],
        items[index]?.id ?? '',
      ),
    }));

    const { data: updated, error } = await supabase.rpc(
      'update_quote_transactional' as never,
      {
        _quote_id: quoteId,
        _quote_patch: updatePayload,
        _items: itemsPayload,
        // QBP-08 FIX: passar versão para ativar lock server-side
        _expected_version: expectedVersion ?? null,
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

    return { ...(updated as Quote), items } as Quote;
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
    // Fetch current status + email fields in one query to avoid a second round-trip.
    // rls-allow: SELECT por id; RLS (can_access_quote) valida ownership
    const { data: current, error: fetchErr } = await supabase
      .from('quotes')
      .select('status, client_email, client_name, quote_number, total, valid_until')
      .eq('id', quoteId)
      .single();
    if (fetchErr) throw fetchErr;
    if (!current) throw new Error('Orçamento não encontrado');

    const fromStatus = current.status as QuoteStatus;
    const toStatus = status as QuoteStatus;
    if (fromStatus !== toStatus && !isValidQuoteTransition(fromStatus, toStatus)) {
      const fromLabel = QUOTE_STATUS_CONFIG[fromStatus]?.label ?? fromStatus;
      const toLabel = QUOTE_STATUS_CONFIG[toStatus]?.label ?? toStatus;
      throw new Error(`Transição de status inválida: "${fromLabel}" → "${toLabel}"`);
    }

    // rls-allow: UPDATE de status por id; RLS (can_access_quote) valida ownership
    const { error } = await supabase.from('quotes').update({ status }).eq('id', quoteId);
    if (error) throw error;

    // FIX-E01: fire transactional email for status changes that the client cares about.
    // Fire-and-forget — never throw; a broken email must never roll back the status change.
    const eventType = EMAIL_STATUS_MAP[toStatus];
    if (eventType && current.client_email) {
      sendTransactionalEmail({
        event_type: eventType,
        recipient_email: current.client_email as string,
        recipient_name: (current.client_name as string) ?? undefined,
        data: {
          quote_number: current.quote_number,
          total: current.total,
          valid_until: current.valid_until ?? null,
        },
      }).catch((err) => {
        logger.error('[quoteService.updateQuoteStatus] Email send failed (non-fatal):', err);
      });
    }
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
    return result.records || [];
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
