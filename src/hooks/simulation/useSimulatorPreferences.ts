/**
 * useSimulatorPreferences - Hook para persistir preferências do usuário
 * Melhoria #6: Salva última configuração usada no localStorage + Supabase
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation } from '@tanstack/react-query';
import type { TechniqueSettings } from '@/types/simulation';
import type { Json } from '@/integrations/supabase/types';

import { logger } from '@/lib/logger';
interface SimulatorPreferences {
  lastQuantity: number;
  lastProductId: string | null;
  lastTechniques: string[];
  lastTechniqueSettings: Record<string, TechniqueSettings>;
  defaultColors: number;
  defaultAreaCm2: number;
  preferredView: 'cards' | 'matrix' | 'table';
  autoExpandResults: boolean;
  showUpsellSuggestions: boolean;
}

const DEFAULT_PREFERENCES: SimulatorPreferences = {
  lastQuantity: 100,
  lastProductId: null,
  lastTechniques: [],
  lastTechniqueSettings: {},
  defaultColors: 1,
  defaultAreaCm2: 100,
  preferredView: 'cards',
  autoExpandResults: true,
  showUpsellSuggestions: true,
};

const STORAGE_KEY = 'simulator_preferences';

export function useSimulatorPreferences() {
  const { user } = useAuth();
  const [preferences, setPreferencesState] = useState<SimulatorPreferences>(DEFAULT_PREFERENCES);
  const [isLoaded, setIsLoaded] = useState(false);

  // Fetch preferences from Supabase (if user is logged in)
  // Uses the 'preferences' JSONB column with a 'simulator' key
  const { data: cloudPreferences } = useQuery({
    queryKey: ['simulator-preferences', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error || !data?.preferences) return null;

      // Extract simulator preferences from nested key
      const prefs = data.preferences as Record<string, unknown>;
      if (!prefs?.simulator) return null;
      return prefs.simulator as SimulatorPreferences;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Mutation to save preferences to Supabase (merged into 'preferences.simulator')
  const saveToCloudMutation = useMutation({
    mutationFn: async (prefs: SimulatorPreferences) => {
      if (!user) return;

      // First, fetch existing preferences to merge
      const { data: existingData } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('user_id', user.id)
        .maybeSingle();

      const existingPrefs = (existingData?.preferences as Record<string, unknown>) || {};

      const { error } = await supabase
        .from('profiles')
        .update({
          // merged JSON-serializable preferences persisted in profiles.preferences
          preferences: {
            ...existingPrefs,
            simulator: prefs,
          } as unknown as Json,
        })
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onError: (error) => {
      logger.error('Error saving preferences to cloud:', error);
    },
  });

  // Load preferences: Cloud first, then localStorage fallback
  useEffect(() => {
    const loadPreferences = () => {
      try {
        // If cloud preferences are available, use them
        if (cloudPreferences) {
          setPreferencesState({ ...DEFAULT_PREFERENCES, ...cloudPreferences });
          // Also update localStorage
          localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudPreferences));
        } else {
          // Fallback to localStorage
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            const parsed = JSON.parse(stored);
            setPreferencesState({ ...DEFAULT_PREFERENCES, ...parsed });
          }
        }
      } catch (error) {
        logger.error('Error loading preferences:', error);
      }
      setIsLoaded(true);
    };

    loadPreferences();
  }, [cloudPreferences]);

  // Save preferences to localStorage AND Supabase (debounced)
  const savePreferences = useCallback(
    (newPrefs: Partial<SimulatorPreferences>) => {
      setPreferencesState((prev) => {
        const updated = { ...prev, ...newPrefs };

        // Save to localStorage immediately
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch (error) {
          logger.error('Error saving preferences to localStorage:', error);
        }

        // Save to cloud (debounced via mutation)
        if (user) {
          // Debounce cloud saves by 2 seconds
          const timeoutKey = 'simulator_prefs_save_timeout';
          if ((window as unknown as Record<string, ReturnType<typeof setTimeout>>)[timeoutKey]) {
            clearTimeout(
              (window as unknown as Record<string, ReturnType<typeof setTimeout>>)[timeoutKey],
            );
          }
          (window as unknown as Record<string, ReturnType<typeof setTimeout>>)[timeoutKey] =
            setTimeout(() => {
              saveToCloudMutation.mutate(updated);
            }, 2000);
        }

        return updated;
      });
    },
    [user, saveToCloudMutation],
  );

  // Individual setters
  const setLastQuantity = useCallback(
    (quantity: number) => {
      savePreferences({ lastQuantity: quantity });
    },
    [savePreferences],
  );

  const setLastProductId = useCallback(
    (productId: string | null) => {
      savePreferences({ lastProductId: productId });
    },
    [savePreferences],
  );

  const setLastTechniques = useCallback(
    (techniques: string[]) => {
      savePreferences({ lastTechniques: techniques });
    },
    [savePreferences],
  );

  const setLastTechniqueSettings = useCallback(
    (settings: Record<string, TechniqueSettings>) => {
      savePreferences({ lastTechniqueSettings: settings });
    },
    [savePreferences],
  );

  const setPreferredView = useCallback(
    (view: 'cards' | 'matrix' | 'table') => {
      savePreferences({ preferredView: view });
    },
    [savePreferences],
  );

  const setDefaultColors = useCallback(
    (colors: number) => {
      savePreferences({ defaultColors: colors });
    },
    [savePreferences],
  );

  const setDefaultAreaCm2 = useCallback(
    (area: number) => {
      savePreferences({ defaultAreaCm2: area });
    },
    [savePreferences],
  );

  const toggleAutoExpandResults = useCallback(() => {
    savePreferences({ autoExpandResults: !preferences.autoExpandResults });
  }, [preferences.autoExpandResults, savePreferences]);

  const toggleShowUpsellSuggestions = useCallback(() => {
    savePreferences({ showUpsellSuggestions: !preferences.showUpsellSuggestions });
  }, [preferences.showUpsellSuggestions, savePreferences]);

  // Save entire session at once
  const saveCurrentSession = useCallback(
    (session: {
      quantity: number;
      productId: string | null;
      techniques: string[];
      settings: Record<string, TechniqueSettings>;
    }) => {
      savePreferences({
        lastQuantity: session.quantity,
        lastProductId: session.productId,
        lastTechniques: session.techniques,
        lastTechniqueSettings: session.settings,
      });
    },
    [savePreferences],
  );

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    setPreferencesState(DEFAULT_PREFERENCES);
    localStorage.removeItem(STORAGE_KEY);
    if (user) {
      saveToCloudMutation.mutate(DEFAULT_PREFERENCES);
    }
  }, [user, saveToCloudMutation]);

  // Force sync to cloud
  const syncToCloud = useCallback(() => {
    if (user) {
      saveToCloudMutation.mutate(preferences);
    }
  }, [user, preferences, saveToCloudMutation]);

  return {
    preferences,
    isLoaded,
    isSyncing: saveToCloudMutation.isPending,
    setLastQuantity,
    setLastProductId,
    setLastTechniques,
    setLastTechniqueSettings,
    setPreferredView,
    setDefaultColors,
    setDefaultAreaCm2,
    toggleAutoExpandResults,
    toggleShowUpsellSuggestions,
    saveCurrentSession,
    resetToDefaults,
    savePreferences,
    syncToCloud,
  };
}
