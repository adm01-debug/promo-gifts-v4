import { logger } from '@/lib/logger';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { untypedFrom } from '@/lib/supabase-untyped';

interface AllowedCountry {
  id: string;
  country_code: string;
  country_name: string;
  is_active: boolean;
  created_at: string;
}

interface GeoBlockingSettings {
  enabled: boolean;
  mode: 'blacklist' | 'whitelist';
}

export function useGeoBlocking() {
  const { user } = useAuth();
  const [countries, setCountries] = useState<AllowedCountry[]>([]);
  const [settings, setSettings] = useState<GeoBlockingSettings>({
    enabled: false,
    mode: 'whitelist',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [currentCountry, setCurrentCountry] = useState<{ code: string; name: string } | null>(null);

  /**
   * BUG-21 FIX: mountedRef para guard de fetchData.
   *
   * PROBLEMA ORIGINAL: fetchData (useCallback com Promise.all de Supabase) não
   * tinha guard de isMounted. Se o componente desmontasse enquanto as queries
   * estavam em vôo, setCountries/setSettings/setIsLoading(false) seriam chamados
   * num componente já desmontado. BUG-17 só corrigiu fetchCurrentCountry.
   *
   * SOLUÇÃO: mountedRef lido dentro de fetchData antes e após o Promise.all.
   */
  const mountedRef = useRef(true);

  // BUG-17 FIX: accept an AbortSignal so the fetch can be cancelled when the
  // component unmounts. Without this, setCurrentCountry would be called on an
  // already-unmounted component if the ipapi.co response arrived after unmount
  // (typical round-trip is 200-500ms — well within navigation timing).
  const fetchCurrentCountry = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch('https://ipapi.co/json/', { signal });
      const data = (await response.json()) as { country_code: string; country_name: string };
      setCurrentCountry({
        code: data.country_code,
        name: data.country_name,
      });
    } catch (error) {
      // AbortError is expected on unmount — silence it
      if (error instanceof Error && error.name === 'AbortError') return;
      logger.error('Error fetching current country:', error);
    }
  }, []);

  const fetchData = useCallback(async () => {
    if (!mountedRef.current) return; // BUG-21 FIX: guard pré-await
    try {
      const [countriesRes, settingsRes] = await Promise.all([
        untypedFrom('geo_allowed_countries')
          .select('id, country_code, country_name, is_active, created_at')
          .order('country_name'),
        untypedFrom('security_settings')
          .select('id, setting_key, setting_value')
          .eq('setting_key', 'geo_blocking')
          .single(),
      ]);

      if (!mountedRef.current) return; // BUG-21 FIX: guard pós-await (componente pode ter desmontado)

      if (countriesRes.error) throw countriesRes.error;
      setCountries(countriesRes.data || []);

      const settingsResult = settingsRes as unknown as {
        data: { setting_value: GeoBlockingSettings } | null;
      };
      if (settingsResult.data) {
        setSettings(settingsResult.data.setting_value);
      }
    } catch (error) {
      logger.error('Error fetching geo blocking data:', error);
    } finally {
      if (mountedRef.current) setIsLoading(false); // BUG-21 FIX: só atualiza se montado
    }
  }, []); // mountedRef é estável (não precisa nas deps)

  useEffect(() => {
    mountedRef.current = true;
    // Create an AbortController so fetchCurrentCountry can be cancelled on unmount
    const controller = new AbortController();
    fetchCurrentCountry(controller.signal);
    fetchData();
    return () => {
      mountedRef.current = false; // BUG-21 FIX: sinaliza unmount antes de abort
      controller.abort();
    };
  }, [fetchCurrentCountry, fetchData]);

  const toggleEnabled = useCallback(
    async (enabled: boolean): Promise<{ success: boolean; error?: string }> => {
      try {
        const newSettings = { ...settings, enabled };
        const { error } = await untypedFrom('security_settings')
          .update({
            setting_value: newSettings,
            updated_at: new Date().toISOString(),
            updated_by: user?.id,
          })
          .eq('setting_key', 'geo_blocking');

        if (error) throw error;
        setSettings(newSettings);
        return { success: true };
      } catch (error: unknown) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Erro desconhecido',
        };
      }
    },
    [settings, user],
  );

  const addCountry = useCallback(
    async (
      countryCode: string,
      countryName: string,
    ): Promise<{ success: boolean; error?: string }> => {
      if (!user) {
        return { success: false, error: 'Usuário não autenticado' };
      }

      try {
        const { error } = await untypedFrom('geo_allowed_countries').insert({
          country_code: countryCode.toUpperCase(),
          country_name: countryName,
          created_by: user.id,
        });

        if (error) {
          if (error.code === '23505') {
            return { success: false, error: 'Este país já está cadastrado' };
          }
          throw error;
        }

        await fetchData();
        return { success: true };
      } catch (error: unknown) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Erro desconhecido',
        };
      }
    },
    [user, fetchData],
  );

  const removeCountry = useCallback(
    async (id: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const { error } = await untypedFrom('geo_allowed_countries').delete().eq('id', id);

        if (error) throw error;
        await fetchData();
        return { success: true };
      } catch (error: unknown) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Erro desconhecido',
        };
      }
    },
    [fetchData],
  );

  const toggleCountry = useCallback(
    async (id: string, isActive: boolean): Promise<{ success: boolean; error?: string }> => {
      try {
        const { error } = await untypedFrom('geo_allowed_countries')
          .update({ is_active: isActive })
          .eq('id', id);

        if (error) throw error;
        await fetchData();
        return { success: true };
      } catch (error: unknown) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Erro desconhecido',
        };
      }
    },
    [fetchData],
  );

  const isCountryAllowed = useCallback(
    (countryCode: string): boolean => {
      if (!settings.enabled) return true;

      const activeCountries = countries.filter((c) => c.is_active);
      if (activeCountries.length === 0) return true;

      return activeCountries.some(
        (c) => c.country_code.toUpperCase() === countryCode.toUpperCase(),
      );
    },
    [settings.enabled, countries],
  );

  return {
    countries,
    settings,
    isLoading,
    currentCountry,
    isEnabled: settings.enabled,
    toggleEnabled,
    addCountry,
    removeCountry,
    toggleCountry,
    isCountryAllowed,
    refetch: fetchData,
  };
}
