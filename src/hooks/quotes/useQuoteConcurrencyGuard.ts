/**
 * useQuoteConcurrencyGuard — detecção de edição simultânea em orçamentos.
 *
 * Problema: dois usuários abrindo o mesmo orçamento podem sobrescrever
 * as mudanças um do outro sem perceber ("last write wins").
 *
 * Solução client-side: armazena o `updated_at` no momento da abertura
 * e verifica se ele mudou antes de qualquer salvamento.
 *
 * @example
 *   const { checkForConflict, resetBaseline } = useQuoteConcurrencyGuard(quote);
 *
 *   const handleSave = async () => {
 *     const conflict = await checkForConflict();
 *     if (conflict) {
 *       toast.error(`Orçamento modificado por ${conflict.modifiedBy} em ${conflict.modifiedAt}`);
 *       return;
 *     }
 *     await saveQuote();
 *   };
 */
import { useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Quote } from '@/hooks/quotes/quoteTypes';

export interface ConflictInfo {
  /** Timestamp da modificação concorrente (ISO string) */
  modifiedAt: string;
  /** Texto formatado para exibição ao usuário */
  label: string;
}

export function useQuoteConcurrencyGuard(quote: Quote | null | undefined) {
  // BUG-CONCURRENCY-BASELINE FIX: useRef initializer runs on mount when quote is
  // still null (loading from Supabase). The initial value is set once and never
  // updated by React, so baselineRef.current would stay null permanently, making
  // checkForConflict always return null (guard silently disabled).
  // Fix: capture the baseline on the first render where quote.updated_at is available.
  const baselineRef = useRef<string | null>(null);
  const baselineSetRef = useRef(false);
  if (quote?.updated_at && !baselineSetRef.current) {
    baselineRef.current = quote.updated_at;
    baselineSetRef.current = true;
  }

  /**
   * Redefine o baseline após um save bem-sucedido para evitar
   * falsos positivos no próximo check.
   */
  const resetBaseline = useCallback((newUpdatedAt?: string) => {
    baselineRef.current = newUpdatedAt ?? new Date().toISOString();
  }, []);

  /**
   * Verifica se o orçamento foi modificado por outra sessão/usuário
   * desde que o abrimos.
   *
   * Retorna `null` se não há conflito, ou um `ConflictInfo` se há.
   */
  const checkForConflict = useCallback(async (): Promise<ConflictInfo | null> => {
    if (!quote?.id || !baselineRef.current) return null;

    const { data, error } = await supabase
      // rls-allow: RLS scopes quotes to seller; conflict check reads specific quote by id
      .from('quotes')
      .select('updated_at')
      .eq('id', quote.id)
      .single();

    if (error || !data) return null;

    const remoteUpdatedAt = data.updated_at as string | null;
    if (!remoteUpdatedAt) return null;

    // Compara como datas para ignorar diferenças de timezone
    const remote = new Date(remoteUpdatedAt);
    const baseline = new Date(baselineRef.current);

    if (remote > baseline) {
      // Formata timestamp para PT-BR
      const label = remote.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo',
      });

      return { modifiedAt: remoteUpdatedAt, label };
    }

    return null;
  }, [quote?.id]);

  return { checkForConflict, resetBaseline };
}
