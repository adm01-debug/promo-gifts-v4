/**
 * useNextQuoteNumberPreview — Prévia (estimativa) do próximo `quote_number`.
 *
 * Lê os últimos quote_numbers do ano corrente e calcula `~N+1/YY`.
 * Apenas exibição: o trigger no INSERT é a SSOT do número definitivo.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { computeNextQuoteNumberPreview } from '@/utils/quote-number';
import { logger } from '@/lib/logger';

export function useNextQuoteNumberPreview(enabled: boolean): string | null {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const yy = String(new Date().getFullYear() % 100).padStart(2, '0');
        const { data, error } = await supabase
          .from('quotes')
          .select('quote_number')
          .like('quote_number', `%/${yy}`)
          .order('created_at', { ascending: false })
          .limit(50);
        if (error) {
          logger.warn('[next-quote-preview] query failed:', error);
          return;
        }
        if (cancelled) return;
        const nums = (data ?? []).map((r) => (r as { quote_number: string | null }).quote_number);
        setPreview(computeNextQuoteNumberPreview(nums));
      } catch (err) {
        logger.warn('[next-quote-preview] unexpected:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return preview;
}
