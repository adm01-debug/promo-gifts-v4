import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { type PersonalizationArea } from '@/components/mockup/MultiAreaManager';
import type { Json } from '@/integrations/supabase/types';

import { logger } from '@/lib/logger';
const LOCAL_STORAGE_KEY = 'mockup_draft_v1';
const AUTO_SAVE_DELAY = 2000; // 2 segundos de debounce

export interface MockupDraftData {
  productId: string | null;
  productName: string | null;
  techniqueId: string | null;
  techniqueName: string | null;
  clientId: string | null;
  clientName: string | null;
  personalizationAreas: PersonalizationArea[];
  updatedAt: string;
}

interface UseMockupDraftOptions {
  draftKey?: string;
}

export function useMockupDraft(options: UseMockupDraftOptions = {}) {
  const { draftKey = 'default' } = options;
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const saveToLocal = useCallback(
    (data: MockupDraftData) => {
      try {
        const key = `${LOCAL_STORAGE_KEY}_${user?.id || 'anonymous'}_${draftKey}`;
        // BUG-DRAFT-LOCAL-STORAGE-QUOTA FIX: strip data URL logos before writing to
        // localStorage — a single 5MB upload encodes to ~7MB base64 which easily
        // blows the 5-10MB per-origin quota and causes a silent DOMException.
        // Only keep http(s) URLs (already-uploaded logos); the loadDraft
        // re-hydration path restores data URLs from the backend when available.
        const safeData: MockupDraftData = {
          ...data,
          personalizationAreas: data.personalizationAreas.map((a) => ({
            ...a,
            logoPreview: a.logoPreview?.startsWith('http') ? a.logoPreview : null,
          })),
        };
        localStorage.setItem(key, JSON.stringify(safeData));
      } catch (err) {
        logger.error('Erro ao salvar no localStorage:', err);
      }
    },
    [user?.id, draftKey],
  );

  const loadFromLocal = useCallback((): MockupDraftData | null => {
    try {
      const key = `${LOCAL_STORAGE_KEY}_${user?.id || 'anonymous'}_${draftKey}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (err) {
      logger.error('Erro ao carregar do localStorage:', err);
    }
    return null;
  }, [user?.id, draftKey]);

  // BUG-A FIX: removed 3 FK pre-validation queries (product, technique, client).
  // These fired on every auto-save (every 2s during active editing), generating
  // ~90 unnecessary SELECT queries per 5 minutes of work.
  // The upsert's 23503 fallback handles FK violations gracefully.
  const saveToBackend = useCallback(
    async (data: MockupDraftData): Promise<boolean> => {
      if (!user) return false;

      setIsSaving(true);
      setError(null);

      try {
        const areasWithoutLogos = data.personalizationAreas.map((a) => ({
          ...a,
          logoPreview: null,
        }));

        const firstLogo = data.personalizationAreas.find((a) => a.logoPreview)?.logoPreview || null;
        const safeLogoData = firstLogo && firstLogo.startsWith('http') ? firstLogo : null;

        // BUG-A FIX: IDs used directly — no pre-validation queries.
        // FK violations are caught below and handled via fallback.
        const safeProductId: string | null = data.productId ?? null;
        const safeTechniqueId: string | null = data.techniqueId ?? null;
        const safeClientId: string | null = data.clientId ?? null;

        const payload = {
          user_id: user.id,
          draft_key: draftKey,
          product_id: safeProductId,
          product_name: data.productName,
          technique_id: safeTechniqueId,
          technique_name: data.techniqueName,
          client_id: safeClientId,
          client_name: data.clientName,
          personalization_areas: areasWithoutLogos as unknown as Json,
          logo_data: safeLogoData,
          updated_at: new Date().toISOString(),
        };

        const { error: upsertError } = await supabase
          .from('mockup_drafts')
          .upsert(payload, { onConflict: 'user_id,draft_key' });

        if (upsertError) {
          if (upsertError.code === '23503') {
            logger.warn('[useMockupDraft] FK violation on draft save — falling back to null IDs.', {
              productId: safeProductId,
              techniqueId: safeTechniqueId,
              clientId: safeClientId,
            });
            // BUG-17 FIX: was `.update()` — silently wrote 0 rows on first-ever
            // save (no row exists yet), while still calling setLastSaved and
            // returning true. Using `.upsert()` guarantees the row is created
            // even when the FK-violating draft has never been persisted before.
            const { error: updateError } = await supabase
              .from('mockup_drafts')
              .upsert(
                {
                  user_id: payload.user_id,
                  draft_key: payload.draft_key,
                  product_name: payload.product_name,
                  technique_name: payload.technique_name,
                  client_name: payload.client_name,
                  personalization_areas: payload.personalization_areas,
                  logo_data: payload.logo_data,
                  updated_at: payload.updated_at,
                  product_id: null,
                  technique_id: null,
                  client_id: null,
                },
                { onConflict: 'user_id,draft_key' },
              );

            if (updateError) throw updateError;
          } else {
            throw upsertError;
          }
        }

        setLastSaved(new Date());
        setError(null);
        return true;
      } catch (err: unknown) {
        logger.error('Erro ao salvar rascunho no backend:', err);
        setError(err instanceof Error ? err.message : 'Erro ao salvar rascunho');
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [user, draftKey],
  );

  const loadFromBackend = useCallback(async (): Promise<MockupDraftData | null> => {
    if (!user) return null;

    try {
      const { data, error: fetchError } = await supabase
        .from('mockup_drafts')
        .select('*')
        .eq('user_id', user.id)
        .eq('draft_key', draftKey)
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }

      if (data) {
        const areas = Array.isArray(data.personalization_areas)
          ? (data.personalization_areas as unknown[]).map((item) => {
              const a = item as Record<string, unknown>;
              return {
                id: (a.id as string | undefined) || crypto.randomUUID(),
                name: (a.name as string | undefined) || 'Frente',
                positionX: (a.positionX as number | undefined) ?? 50,
                positionY: (a.positionY as number | undefined) ?? 50,
                logoWidth: (a.logoWidth as number | undefined) ?? 5,
                logoHeight: (a.logoHeight as number | undefined) ?? 3,
                logoRotation: (a.logoRotation as number | undefined) ?? 0,
                logoScale: (a.logoScale as number | undefined) ?? 100,
                logoPreview: (a.logoPreview as string | undefined) || null,
              };
            })
          : [];

        if (data.logo_data && areas.length > 0 && !areas[0].logoPreview) {
          areas[0].logoPreview = data.logo_data;
        }

        return {
          productId: data.product_id,
          productName: data.product_name,
          techniqueId: data.technique_id,
          techniqueName: data.technique_name,
          clientId: data.client_id,
          clientName: data.client_name,
          personalizationAreas: areas,
          updatedAt: data.updated_at,
        };
      }
    } catch (err) {
      logger.error('Erro ao carregar rascunho do backend:', err);
    }
    return null;
  }, [user, draftKey]);

  const saveDraft = useCallback(
    (data: MockupDraftData) => {
      saveToLocal(data);

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        saveToBackend(data);
      }, AUTO_SAVE_DELAY);
    },
    [saveToLocal, saveToBackend],
  );

  const loadDraft = useCallback(async (): Promise<MockupDraftData | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const [localData, backendData] = await Promise.all([
        Promise.resolve(loadFromLocal()),
        loadFromBackend(),
      ]);

      if (localData && backendData) {
        const localDate = new Date(localData.updatedAt || 0);
        const backendDate = new Date(backendData.updatedAt || 0);
        const chosen = backendDate > localDate ? backendData : localData;
        // AUDIT 2026-06-17 — data: URL logos are intentionally NOT persisted to the
        // backend draft (saveToBackend only keeps http logos to avoid multi-MB base64
        // rows), but localStorage keeps the full preview. When the backend copy wins
        // the recency check it would otherwise come back with the logo stripped, so a
        // freshly-uploaded logo silently vanished on reload. Re-hydrate any missing
        // logo previews from the local copy (matched by area id, falling back to index).
        if (chosen === backendData) {
          chosen.personalizationAreas = chosen.personalizationAreas.map((a, i) => {
            if (a.logoPreview) return a;
            const localMatch =
              localData.personalizationAreas.find((la) => la.id === a.id) ??
              localData.personalizationAreas[i];
            return localMatch?.logoPreview ? { ...a, logoPreview: localMatch.logoPreview } : a;
          });
        }
        return chosen;
      }

      return backendData || localData;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar rascunho');
      return loadFromLocal();
    } finally {
      setIsLoading(false);
    }
  }, [loadFromLocal, loadFromBackend]);

  const clearDraft = useCallback(async () => {
    // BUG-1 FIX: cancel pending debounced save BEFORE clearing storage — otherwise
    // a 2s timer started by the last saveDraft() call would re-create the draft
    // row/localStorage entry immediately after we delete it (race condition).
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    try {
      const key = `${LOCAL_STORAGE_KEY}_${user?.id || 'anonymous'}_${draftKey}`;
      localStorage.removeItem(key);
    } catch (err) {
      logger.error('Erro ao limpar localStorage:', err);
    }

    if (user) {
      try {
        const { error: deleteError } = await supabase
          .from('mockup_drafts')
          .delete()
          .eq('user_id', user.id)
          .eq('draft_key', draftKey);
        if (deleteError) throw deleteError;
      } catch (err) {
        logger.error('Erro ao limpar rascunho do backend:', err);
      }
    }

    setLastSaved(null);
  }, [user, draftKey]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    saveDraft,
    loadDraft,
    clearDraft,
    isSaving,
    isLoading,
    lastSaved,
    error,
  };
}
