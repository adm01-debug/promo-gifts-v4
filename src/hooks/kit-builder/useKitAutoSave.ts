/**
 * Kit Auto-Save Hook
 * Saves kit state automatically with debounce (5 seconds).
 * Only triggers after the user has made meaningful changes.
 *
 * BUG-11 FIX: usar refs para dependencias instaveis (kitState, kitQuantity,
 * onKitIdCreated) para que saveToDb nao seja recriado a cada render do pai.
 * Timer de 5s isolado de re-renders intermediarios.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { KitState } from '@/lib/kit-builder';
import type { Json } from '@/integrations/supabase/types';
import { logger } from '@/lib/logger';

const AUTO_SAVE_DELAY_MS = 5000;

interface AutoSaveResult {
  lastSavedAt: Date | null;
  isSaving: boolean;
  autoSavedKitId: string | null;
}

export function useKitAutoSave(
  kitState: KitState,
  kitQuantity: number,
  currentKitId: string | undefined,
  onKitIdCreated?: (id: string) => void,
): AutoSaveResult {
  const { user } = useAuth();
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [autoSavedKitId, setAutoSavedKitId] = useState<string | null>(currentKitId || null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const snapshotRef = useRef<string>('');
  const isFirstRender = useRef(true);

  /**
   * BUG-11 FIX: usar refs para dependencias instaveis.
   *
   * PROBLEMA ORIGINAL: `onKitIdCreated` (funcao inline do componente pai, nova referencia
   * a cada render) estava nas deps de `saveToDb` via useCallback. Isso recriava `saveToDb`
   * a cada render do pai -> o useEffect de snapshot incluia `saveToDb` nas deps -> seu cleanup
   * (`clearTimeout(timerRef.current)`) cancelava o timer de 5s antes de disparar -> o auto-save
   * nunca executava.
   *
   * SOLUCAO: todas as props instaveis lidas via refs. `saveToDb` tem deps estaveis
   * [user?.id, currentKitId] e nao precisa ser recriado a cada render.
   * O timer de 5s sobrevive a re-renders do componente pai.
   */
  const kitStateRef = useRef<KitState>(kitState);
  const kitQuantityRef = useRef<number>(kitQuantity);
  const onKitIdCreatedRef = useRef<((id: string) => void) | undefined>(onKitIdCreated);
  const autoSavedKitIdRef = useRef<string | null>(currentKitId || null);

  // Manter refs sincronizadas a cada render -- sem useEffect para evitar batching delay
  kitStateRef.current = kitState;
  kitQuantityRef.current = kitQuantity;
  onKitIdCreatedRef.current = onKitIdCreated;

  // saveToDb usa apenas deps estaveis -- nao recria a cada mudanca de kitState/onKitIdCreated
  const saveToDb = useCallback(async () => {
    const currentKitState = kitStateRef.current;
    const currentKitQuantity = kitQuantityRef.current;
    const currentOnKitIdCreated = onKitIdCreatedRef.current;

    if (!user?.id) return;

    // Don't auto-save empty kits
    if (!currentKitState.box && currentKitState.items.length === 0) return;

    const payload = {
      user_id: user.id,
      name: currentKitState.name || 'Kit sem nome',
      status: 'draft' as const,
      kit_type: currentKitState.kitType || 'montado',
      box_data: currentKitState.box
        ? (structuredClone(currentKitState.box) as unknown as Json)
        : null,
      items_data: structuredClone(currentKitState.items) as unknown as Json,
      personalization_data: structuredClone(currentKitState.personalization) as unknown as Json,
      kit_quantity: currentKitQuantity,
      box_price: currentKitState.boxPrice,
      items_price: currentKitState.itemsPrice,
      personalization_price: currentKitState.personalizationPrice,
      total_price: currentKitState.totalPrice,
      volume_usage_percent: currentKitState.volumeUsagePercent,
      updated_at: new Date().toISOString(),
    };

    setIsSaving(true);
    try {
      const kitId = autoSavedKitIdRef.current || currentKitId;
      if (kitId) {
        // BUG-AUTOSAVE-UPDATE-SILENT-FAIL FIX: bare await swallowed RLS and constraint
        // errors — if update fails the user keeps seeing "saved" state while data is lost.
        const { error: updateErr } = await supabase
          .from('custom_kits')
          .update(payload)
          .eq('id', kitId)
          .eq('user_id', user.id);
        if (updateErr) logger.warn('[auto-save] Update failed:', updateErr);
      } else {
        // BUG-AUTOSAVE-INSERT-SILENT-FAIL FIX: bare data destructure missed { error }.
        // If insert fails (e.g. RLS denial), data=null but no error is logged and the
        // kit ID is never assigned, causing all subsequent saves to re-attempt insert.
        const { data, error: insertErr } = await supabase
          .from('custom_kits')
          .insert(payload)
          .select('id')
          .single();
        if (insertErr) {
          logger.warn('[auto-save] Insert failed:', insertErr);
        } else if (data) {
          autoSavedKitIdRef.current = data.id;
          setAutoSavedKitId(data.id);
          currentOnKitIdCreated?.(data.id);
        }
      }
      setLastSavedAt(new Date());
    } catch (err) {
      logger.warn('[auto-save] Failed:', err);
    } finally {
      setIsSaving(false);
    }
  }, [user?.id, currentKitId]); // FIX: removidos kitState, kitQuantity, onKitIdCreated

  // Snapshot effect: agenda o timer quando o estado muda de forma relevante
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      snapshotRef.current = JSON.stringify({
        box: kitState.box?.id,
        items: kitState.items.map((i) => `${i.id}:${i.quantity}`),
        personalization: kitState.personalization,
        name: kitState.name,
        qty: kitQuantity,
      });
      return;
    }

    const newSnapshot = JSON.stringify({
      box: kitState.box?.id,
      items: kitState.items.map((i) => `${i.id}:${i.quantity}`),
      personalization: kitState.personalization,
      name: kitState.name,
      qty: kitQuantity,
    });

    if (newSnapshot === snapshotRef.current) return;
    snapshotRef.current = newSnapshot;

    // Cancela timer anterior (debounce) e reagenda
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(saveToDb, AUTO_SAVE_DELAY_MS);

    // NOTA: sem cleanup aqui -- o timer deve sobreviver a re-renders intermedios.
    // O cleanup de unmount e tratado pelo effect dedicado abaixo.
  }, [
    kitState.box?.id,
    kitState.items,
    kitState.personalization,
    kitState.name,
    kitQuantity,
    saveToDb,
  ]);

  // Cleanup dedicado ao unmount -- cancela qualquer timer pendente
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Update autoSavedKitId when currentKitId changes externally
  useEffect(() => {
    if (currentKitId) {
      setAutoSavedKitId(currentKitId);
      autoSavedKitIdRef.current = currentKitId;
    }
  }, [currentKitId]);

  return { lastSavedAt, isSaving, autoSavedKitId };
}
