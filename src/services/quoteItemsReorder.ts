/**
 * quoteItemsReorder — Persistência granular do sort_order dos itens de um orçamento.
 *
 * Em vez de depender do autosave do quote inteiro (que recalcula totais, dispara
 * triggers de validação de desconto/alçada e abre janela de race), este helper
 * faz updates direcionados em `quote_items.sort_order`. RLS atual já valida
 * ownership via `can_access_quote(quote_id)`.
 *
 * Estratégia:
 *  - Recebe lista de `{id, sort_order}` (somente itens com id persistido).
 *  - Roda updates em paralelo (Promise.all) em chunks de 25 para não estourar
 *    o limite de conexões do PostgREST.
 *  - Retorna o número de linhas atualizadas; lança erro saneado em falha.
 */
import { supabase } from '@/integrations/supabase/client';
import { sanitizeMessage } from '@/lib/security/sanitize-message';
import { logger } from '@/lib/logger';

export interface ReorderRow {
  id: string;
  sort_order: number;
}

const CHUNK_SIZE = 25;

export async function persistItemsOrder(
  quoteId: string,
  rows: ReorderRow[],
): Promise<number> {
  if (!quoteId) throw new Error('quoteId é obrigatório');
  const valid = rows.filter((r) => r && typeof r.id === 'string' && r.id.length > 0);
  if (valid.length === 0) return 0;

  let updated = 0;
  for (let i = 0; i < valid.length; i += CHUNK_SIZE) {
    const chunk = valid.slice(i, i + CHUNK_SIZE);
    const results = await Promise.all(
      chunk.map((row) =>
        supabase
          .from('quote_items')
          .update({ sort_order: row.sort_order })
          .eq('id', row.id)
          .eq('quote_id', quoteId),
      ),
    );
    for (const r of results) {
      if (r.error) {
        const message = sanitizeMessage(r.error, {
          fallback: 'Não foi possível reordenar os itens. Tente novamente.',
        });
        logger.error('[persistItemsOrder] update failed', r.error);
        throw new Error(message);
      }
      updated += 1;
    }
  }
  return updated;
}
