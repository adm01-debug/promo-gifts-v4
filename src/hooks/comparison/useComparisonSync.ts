/**
 * useComparisonSync — Persistência cross-device da comparação atual.
 * - localStorage continua sendo a fonte primária (offline-first)
 * - Quando logado, faz upsert em user_comparisons (sem share_token, slot "current")
 * - Faz merge inteligente ao logar: união (max 4) com base no localStorage
 */
import { useEffect, useRef } from 'react';
import { useComparisonStore, type CompareItem } from '@/stores/useComparisonStore';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { logger } from '@/lib/logger';
const CURRENT_SLOT_KEY = 'current'; // marker no campo client_name para o slot "atual"

export function useComparisonSync() {
  const compareItems = useComparisonStore((s) => s.compareItems);
  const hydratedRef = useRef(false);
  const userIdRef = useRef<string | null>(null);

  // Hidratação inicial ao logar
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id ?? null;
      if (!mounted || !userId) return;
      userIdRef.current = userId;

      try {
        const { data: rows } = await supabase
          .from('user_comparisons')
          .select('id, items, updated_at')
          .eq('user_id', userId)
          .eq('client_name', CURRENT_SLOT_KEY)
          .is('share_token', null)
          .order('updated_at', { ascending: false })
          .limit(1);

        const remote = (rows?.[0]?.items as CompareItem[] | undefined) ?? [];
        const local = useComparisonStore.getState().compareItems;

        // Merge inteligente: união preservando ordem local primeiro, max 4
        const seen = new Set<string>();
        const keyOf = (i: CompareItem) =>
          i.variant?.variant_id ? `${i.productId}::${i.variant.variant_id}` : i.productId;
        const merged: CompareItem[] = [];
        for (const item of [...local, ...remote]) {
          const k = keyOf(item);
          if (!seen.has(k) && merged.length < 4) {
            seen.add(k);
            merged.push(item);
          }
        }
        // Aplicar merge no store
        if (JSON.stringify(merged) !== JSON.stringify(local)) {
          useComparisonStore.setState({
            compareItems: merged,
            compareIds: merged.map((i) => i.productId),
            compareCount: merged.length,
            canAddMore: merged.length < 4,
          });
        }
      } catch (e) {
        logger.warn('[useComparisonSync] hydrate failed', e);
      } finally {
        hydratedRef.current = true;
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Upsert com debounce ao mudar
  useEffect(() => {
    if (!hydratedRef.current || !userIdRef.current) return;
    const userId = userIdRef.current;
    const t = setTimeout(async () => {
      try {
        // Busca registro existente do slot "current"
        const { data: existing } = await supabase
          .from('user_comparisons')
          .select('id')
          .eq('user_id', userId)
          .eq('client_name', CURRENT_SLOT_KEY)
          .is('share_token', null)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('user_comparisons')
            .update({
              items: structuredClone(compareItems) as unknown as Json,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
        } else if (compareItems.length > 0) {
          await supabase.from('user_comparisons').insert({
            user_id: userId,
            client_name: CURRENT_SLOT_KEY,
            items: structuredClone(compareItems) as unknown as Json,
            is_public: false,
          });
        }
      } catch (e) {
        logger.warn('[useComparisonSync] upsert failed', e);
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [compareItems]);
}
