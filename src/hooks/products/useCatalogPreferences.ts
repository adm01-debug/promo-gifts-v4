import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation } from '@tanstack/react-query';
import type { SortOption } from '@/hooks/products/useCatalogState';
import type { Json } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/ui/use-toast';
// BUG-PREF-01 FIX: importar SORT_OPTIONS para validar sortBy ao carregar de storage.
import { SORT_OPTIONS } from '@/constants/filters';

import { logger } from '@/lib/logger';
interface CatalogPreferences {
  sortBy: SortOption;
  lastSearchTerm?: string;
  lastSearchSortBy?: SortOption;
}

const DEFAULT_PREFERENCES: CatalogPreferences = {
  sortBy: 'newest',
};

const STORAGE_KEY = 'catalog_preferences';

// BUG-PREF-01 FIX: Conjunto dos valores válidos de sortBy derivado do SSOT.
// Localizado aqui para validar antes de gravar no state — sem depender
// da validação em useCatalogState (defense-in-depth).
const CATALOG_VALID_SORT_VALUES = new Set(SORT_OPTIONS.map((o) => o.value));

/**
 * BUG-PREF-01 FIX: Sanitiza um valor de sortBy antes de aplicar ao state.
 * Retorna 'newest' para qualquer valor inválido, null ou ausente.
 * Previne que localStorage/cloud stale (ex: 'relevance' de versão anterior)
 * quebre o catálogo ou entre no state sem validação.
 */
function sanitizeSortBy(val: unknown): SortOption {
  return typeof val === 'string' && CATALOG_VALID_SORT_VALUES.has(val)
    ? (val as SortOption)
    : 'newest';
}

export function useCatalogPreferences() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [preferences, setPreferencesState] = useState<CatalogPreferences>(DEFAULT_PREFERENCES);
  const [isLoaded, setIsLoaded] = useState(false);

  const { data: cloudPreferences } = useQuery({
    queryKey: ['catalog-preferences', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error || !data?.preferences) {
        if (error) {
          logger.error('Error fetching catalog preferences:', error);
          toast({
            title: 'Erro ao carregar preferências',
            description: 'Usando ordenação padrão do sistema.',
            variant: 'destructive',
          });
        }
        return null;
      }

      const prefs = data.preferences as Record<string, unknown>;
      if (!prefs?.catalog) return null;
      return prefs.catalog as CatalogPreferences;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const { mutate: saveToCloud } = useMutation({
    mutationFn: async (prefs: CatalogPreferences) => {
      if (!user) return;

      const { data: existingData } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('user_id', user.id)
        .maybeSingle();

      const existingPrefs = (existingData?.preferences as Record<string, unknown>) || {};

      const { error } = await supabase
        .from('profiles')
        .update({
          preferences: {
            ...existingPrefs,
            catalog: prefs,
          } as unknown as Json,
        })
        .eq('user_id', user.id);

      if (error) throw error;
    },
  });

  useEffect(() => {
    const loadPreferences = () => {
      try {
        if (cloudPreferences) {
          // BUG-PREF-01 FIX: Validar sortBy antes de aplicar ao state.
          // Cloud data pode conter valor stale de versão anterior do app
          // (ex: 'relevance'). Normalizar para 'name' se inválido.
          const validatedCloudPrefs: CatalogPreferences = {
            ...cloudPreferences,
            sortBy: sanitizeSortBy(cloudPreferences.sortBy),
          };
          setPreferencesState(validatedCloudPrefs);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(validatedCloudPrefs));
        } else {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              // BUG-PREF-01 FIX: Validar sortBy antes de aplicar ao state.
              // localStorage pode conter valor stale de versão anterior do app.
              const validatedParsed: Partial<CatalogPreferences> = {
                ...parsed,
                sortBy: sanitizeSortBy(parsed?.sortBy),
              };
              setPreferencesState((prev) => ({ ...prev, ...validatedParsed }));
            } catch (e) {
              logger.error('Error parsing catalog preferences', e);
            }
          }
        }
      } catch (err) {
        logger.error('Failed to load preferences', err);
      }
    };
    loadPreferences();
    setIsLoaded(true);
  }, [cloudPreferences]);

  const updatePreferences = useCallback(
    (newPrefs: Partial<CatalogPreferences>) => {
      setPreferencesState((prev) => {
        const updated = { ...prev, ...newPrefs };

        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch (e) {
          logger.warn('LocalStorage save failed', e);
        }

        if (user) {
          saveToCloud(updated, {
            onError: (err) => {
              logger.warn('Cloud sync failed, will retry on next change', err);
              toast({
                title: 'Erro ao salvar preferência',
                description:
                  'Sua escolha foi aplicada nesta sessão, mas não pôde ser salva na nuvem.',
                variant: 'destructive',
              });
            },
          });
        }

        return updated;
      });
    },
    [user, saveToCloud, toast],
  );

  return {
    preferences,
    isLoaded,
    updatePreferences,
  };
}
