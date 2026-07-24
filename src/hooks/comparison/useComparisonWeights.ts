/**
 * useComparisonWeights — Pesos persistentes do score do comparador (C6 #1).
 * Salva em user_preferences.comparison_weights; cache localStorage como fallback.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import type { ComparisonScoreWeights } from './useComparisonScore';

import { logger } from '@/lib/logger';
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

/**
 * Bridges the two weight shapes. The persisted/DB contract uses
 * `{minQty,colors,verified}` (see `user_preferences.comparison_weights`
 * default), while `useComparisonScore` expects
 * `{minQuantity,colorVariety,verifiedSupplier}`. Feeding one shape into the
 * other silently produced `NaN` scores, so all conversions go through here.
 */
export function mapWeightsToScore(w: ComparisonWeights): ComparisonScoreWeights {
  return {
    price: w.price,
    stock: w.stock,
    minQuantity: w.minQty,
    colorVariety: w.colors,
    verifiedSupplier: w.verified,
    leadTime: w.leadTime,
  };
}

export function mapScoreToWeights(s: ComparisonScoreWeights): ComparisonWeights {
  return {
    price: s.price,
    stock: s.stock,
    minQty: s.minQuantity,
    colors: s.colorVariety,
    verified: s.verifiedSupplier,
    leadTime: s.leadTime,
  };
}

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
    const { error } = await supabase.from('user_preferences').upsert(
      {
        user_id: user.id,
        // ComparisonWeights is an interface (no implicit index signature) so it is
        // not directly assignable to the Json column type; the shape is plain numbers.
        comparison_weights: next as unknown as Json,
      },
      { onConflict: 'user_id' },
    );

    if (error) {
      logger.error('[useComparisonWeights] Failed to save weights:', error);
    }
  }, []);

  const reset = useCallback(() => setWeights(DEFAULT_WEIGHTS), [setWeights]);

  return { weights, setWeights, reset, loading };
}
