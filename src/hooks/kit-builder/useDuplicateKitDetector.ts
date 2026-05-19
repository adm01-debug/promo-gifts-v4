/**
 * useDuplicateKitDetector — verifica se o conjunto atual de SKUs do kit
 * é similar (>=80%) a algum kit existente do usuário. Sugere atualizar
 * em vez de criar novo.
 */
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface DuplicateMatch {
  id: string;
  name: string;
  ratio: number;
  overlap: number;
}

function extractSkus(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((i) => {
      const r = i as Record<string, unknown>;
      const sku = (r?.sku ?? r?.product_sku ?? r?.code) as string | undefined;
      return sku ? String(sku).trim().toLowerCase() : '';
    })
    .filter(Boolean);
}

export function useDuplicateKitDetector() {
  const { user } = useAuth();

  const findDuplicate = useCallback(
    async (
      currentSkus: string[],
      opts?: { excludeId?: string; threshold?: number },
    ): Promise<DuplicateMatch | null> => {
      const threshold = opts?.threshold ?? 0.8;
      if (!user?.id || currentSkus.length === 0) return null;

      const { data, error } = await supabase
        .from('custom_kits')
        .select('id, name, items_data')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(50);
      if (error) return null;

      const current = new Set(currentSkus.map((s) => s.toLowerCase()));
      let best: DuplicateMatch | null = null;

      for (const row of (data ?? []) as Array<{ id: string; name: string; items_data: unknown }>) {
        if (opts?.excludeId && row.id === opts.excludeId) continue;
        const skus = extractSkus(row.items_data);
        if (skus.length === 0) continue;
        const overlap = skus.filter((s) => current.has(s)).length;
        const union = new Set([...skus, ...current]).size;
        const ratio = union > 0 ? overlap / union : 0; // Jaccard
        if (ratio >= threshold && (!best || ratio > best.ratio)) {
          best = { id: row.id, name: row.name, ratio, overlap };
        }
      }
      return best;
    },
    [user?.id],
  );

  return { findDuplicate };
}
