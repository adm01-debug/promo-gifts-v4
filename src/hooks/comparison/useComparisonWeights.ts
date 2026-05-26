/**
 * useComparisonWeights — Pesos persistentes do score do comparador (C6 #1).
 * Salva em user_preferences.comparison_weights; cache localStorage como fallback.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export interface ComparisonWeights {
  price: number;
  stock: number;
  minQty: number;
  colors: number;
  verified: number;
  leadTime: number;
}

export const DEFAULT_WEIGHTS: ComparisonWeights = {
  price: 35,
  stock: 20,
  minQty: 15,
  colors: 10,
  verified: 10,
  leadTime: 10,
};

const LS_KEY = 'comparison-weights';

export function useComparisonWeights() {
  const [weights, setWeightsState] = useState<ComparisonWeights>(() => {
    try {
      const cached = localStorage.getItem(LS_KEY);
      return cached ? { ...DEFAULT_WEIGHTS, ...JSON.parse(cached) } : DEFAULT_WEIGHTS;
    } catch {
      return DEFAULT_WEIGHTS;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('user_preferences')
        .select('comparison_weights')
        .eq('user_id', user.id)
        .maybeSingle();
      if (active && data?.comparison_weights) {
        const w = { ...DEFAULT_WEIGHTS, ...(data.comparison_weights as Record<string, number>) };
        setWeightsState(w);
        localStorage.setItem(LS_KEY, JSON.stringify(w));
      }
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const setWeights = useCallback(async (next: ComparisonWeights) => {
    setWeightsState(next);
    localStorage.setItem(LS_KEY, JSON.stringify(next));
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('user_preferences').upsert(
      {
        user_id: user.id,
        // ComparisonWeights is an interface (no implicit index signature) so it is
        // not directly assignable to the Json column type; the shape is plain numbers.
        comparison_weights: next as unknown as Json,
      },
      { onConflict: 'user_id' },
    );
  }, []);

  const reset = useCallback(() => setWeights(DEFAULT_WEIGHTS), [setWeights]);

  return { weights, setWeights, reset, loading };
}
