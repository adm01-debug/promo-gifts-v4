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
        // BUG-COMPARISONSYNC-HYDRATE-SELECT-SILENT-FAIL FIX: { data: rows } without error
        // check — RLS failure silently produced rows=undefined, treating remote as empty
        // and potentially overwriting local items with an empty merge result.
        const { data: rows, error: rowsErr } = await supabase
          .from('user_comparisons')
          .select('id, items, updated_at')
          .eq('user_id', userId)
          .eq('client_name', CURRENT_SLOT_KEY)
          .is('share_token', null)
          .order('updated_at', { ascending: false })
          .limit(1);
        if (rowsErr) throw rowsErr;

        const remote = (rows?.[0]?.items as unknown as CompareItem[] | undefined) ?? [];
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
        // Lista todos os slots "current" (não usa maybeSingle: sem constraint de
        // unicidade, uma corrida entre abas/dispositivos pode ter criado mais de
        // um — maybeSingle lançaria e travaria o sync para sempre).
        // BUG-COMPARISONSYNC-PERSIST-SELECT-SILENT-FAIL FIX: { data: rows } without error
        // check — RLS failure silently treated as empty, skipping update+dedup entirely.
        const { data: rows, error: rowsErr } = await supabase
          .from('user_comparisons')
          .select('id')
          .eq('user_id', userId)
          .eq('client_name', CURRENT_SLOT_KEY)
          .is('share_token', null)
          .order('updated_at', { ascending: false });
        if (rowsErr) throw rowsErr;

        const ids = (rows ?? []).map((r) => r.id);
        if (ids.length > 0) {
          // BUG-COMPARISON-UPDATE-SILENT-FAIL FIX: bare await swallowed RLS errors.
          const { error: updateErr } = await supabase
            .from('user_comparisons')
            .update({
              items: structuredClone(compareItems) as unknown as Json,
              updated_at: new Date().toISOString(),
            })
            .eq('id', ids[0]);
          if (updateErr) logger.warn('[useComparisonSync] update failed:', updateErr);
          // Auto-cura duplicatas do slot "current".
          if (ids.length > 1) {
            // BUG-COMPARISON-DELETE-SILENT-FAIL FIX: bare await swallowed RLS errors.
            const { error: deleteErr } = await supabase
              .from('user_comparisons')
              .delete()
              .in('id', ids.slice(1));
            if (deleteErr) logger.warn('[useComparisonSync] delete duplicates failed:', deleteErr);
          }
        } else if (compareItems.length > 0) {
          // BUG-COMPARISON-INSERT-SILENT-FAIL FIX: bare await swallowed RLS/constraint errors.
          const { error: insertErr } = await supabase.from('user_comparisons').insert({
            user_id: userId,
            client_name: CURRENT_SLOT_KEY,
            items: structuredClone(compareItems) as unknown as Json,
            is_public: false,
          });
          if (insertErr) logger.warn('[useComparisonSync] insert failed:', insertErr);
        }
      } catch (e) {
        logger.warn('[useComparisonSync] upsert failed', e);
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [compareItems]);

  // Sincronização entre abas: quando outra aba altera o localStorage, reflete no
  // store desta aba. O evento `storage` só dispara em abas que NÃO escreveram,
  // então não há eco/loop.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== 'product-comparison') return;
      try {
        const parsed = e.newValue ? JSON.parse(e.newValue) : [];
        if (!Array.isArray(parsed)) return;
        const items: CompareItem[] =
          parsed.length > 0 && typeof parsed[0] === 'string'
            ? parsed.map((id: string) => ({ productId: id }))
            : parsed;
        const current = useComparisonStore.getState().compareItems;
        if (JSON.stringify(items) !== JSON.stringify(current)) {
          useComparisonStore.setState({
            compareItems: items,
            compareIds: items.map((i) => i.productId),
            compareCount: items.length,
            canAddMore: items.length < 4,
          });
        }
      } catch {
        /* ignore corrupted payloads */
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
}
