import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { type PersonalizationArea } from '@/components/mockup/MultiAreaManager';
import type { Json } from '@/integrations/supabase/types';

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

  // Salvar no localStorage (imediato)
  const saveToLocal = useCallback(
    (data: MockupDraftData) => {
      try {
        const key = `${LOCAL_STORAGE_KEY}_${user?.id || 'anonymous'}_${draftKey}`;
        localStorage.setItem(key, JSON.stringify(data));
      } catch (err) {
        console.error('Erro ao salvar no localStorage:', err);
      }
    },
    [user?.id, draftKey],
  );

  // Carregar do localStorage
  const loadFromLocal = useCallback((): MockupDraftData | null => {
    try {
      const key = `${LOCAL_STORAGE_KEY}_${user?.id || 'anonymous'}_${draftKey}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (err) {
      console.error('Erro ao carregar do localStorage:', err);
    }
    return null;
  }, [user?.id, draftKey]);

  // Salvar no backend (debounced)
  const saveToBackend = useCallback(
    async (data: MockupDraftData): Promise<boolean> => {
      if (!user) return false;

      setIsSaving(true);
      setError(null);

      try {
        // Strip base64 logos from areas to prevent JSONB size overflow
        // Logos are preserved in localStorage only
        const areasWithoutLogos = data.personalizationAreas.map((a) => ({
          ...a,
          logoPreview: null, // Don't persist huge base64 in DB
        }));

        // Only persist URL references in logo_data (never base64)
        const firstLogo = data.personalizationAreas.find((a) => a.logoPreview)?.logoPreview || null;
        const safeLogoData = firstLogo && firstLogo.startsWith('http') ? firstLogo : null;

        // Verify product_id exists in local products table before saving
        // Products from external DB won't have a matching row, so we skip the FK
        let safeProductId: string | null = null;
        if (data.productId) {
          const { data: productRow } = await supabase
            .from('products')
            .select('id')
            .eq('id', data.productId)
            .maybeSingle();
          if (productRow) {
            safeProductId = data.productId;
          }
        }

        // Same check for technique_id
        let safeTechniqueId: string | null = null;
        if (data.techniqueId) {
          const { data: techRow } = await supabase
            .from('personalization_techniques')
            .select('id')
            .eq('id', data.techniqueId)
            .maybeSingle();
          if (techRow) {
            safeTechniqueId = data.techniqueId;
          }
        }

        // Same check for client_id
        let safeClientId: string | null = null;
        if (data.clientId) {
          const { data: clientRow } = await supabase
            .from('bitrix_clients')
            .select('id')
            .eq('id', data.clientId)
            .maybeSingle();
          if (clientRow) {
            safeClientId = data.clientId;
          }
        }

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

        // Try upsert first
        const { error: upsertError } = await supabase
          .from('mockup_drafts')
          .upsert(payload, { onConflict: 'user_id,draft_key' });

        if (upsertError) {
          // If FK violation or conflict, try update-only as fallback
          if (upsertError.code === '23503' || upsertError.code === '409') {
            const { error: updateError } = await supabase
              .from('mockup_drafts')
              .update({
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
              })
              .eq('user_id', user.id)
              .eq('draft_key', draftKey);

            if (updateError) throw updateError;
          } else {
            throw upsertError;
          }
        }

        setLastSaved(new Date());
        setError(null);
        return true;
      } catch (err: unknown) {
        console.error('Erro ao salvar rascunho no backend:', err);
        setError(err instanceof Error ? err.message : 'Erro ao salvar rascunho');
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [user, draftKey],
  );

  // Carregar do backend
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

        // Restaurar logo do campo logo_data se não estiver nas áreas
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
      console.error('Erro ao carregar rascunho do backend:', err);
    }
    return null;
  }, [user, draftKey]);

  // Auto-save híbrido (local imediato + backend debounced)
  const saveDraft = useCallback(
    (data: MockupDraftData) => {
      // Salva imediatamente no localStorage
      saveToLocal(data);

      // Cancela timeout anterior
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Agenda salvamento no backend (debounced)
      saveTimeoutRef.current = setTimeout(() => {
        saveToBackend(data);
      }, AUTO_SAVE_DELAY);
    },
    [saveToLocal, saveToBackend],
  );

  // Carregar rascunho (prioriza backend se mais recente)
  const loadDraft = useCallback(async (): Promise<MockupDraftData | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const [localData, backendData] = await Promise.all([
        Promise.resolve(loadFromLocal()),
        loadFromBackend(),
      ]);

      // Prioriza o mais recente
      if (localData && backendData) {
        const localDate = new Date(localData.updatedAt || 0);
        const backendDate = new Date(backendData.updatedAt || 0);
        return backendDate > localDate ? backendData : localData;
      }

      return backendData || localData;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar rascunho');
      // Fallback para localStorage em caso de erro
      return loadFromLocal();
    } finally {
      setIsLoading(false);
    }
  }, [loadFromLocal, loadFromBackend]);

  // Limpar rascunho
  const clearDraft = useCallback(async () => {
    // Limpa localStorage
    try {
      const key = `${LOCAL_STORAGE_KEY}_${user?.id || 'anonymous'}_${draftKey}`;
      localStorage.removeItem(key);
    } catch (err) {
      console.error('Erro ao limpar localStorage:', err);
    }

    // Limpa backend
    if (user) {
      try {
        await supabase
          .from('mockup_drafts')
          .delete()
          .eq('user_id', user.id)
          .eq('draft_key', draftKey);
      } catch (err) {
        console.error('Erro ao limpar rascunho do backend:', err);
      }
    }

    setLastSaved(null);
  }, [user, draftKey]);

  // Limpar timeout ao desmontar
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
