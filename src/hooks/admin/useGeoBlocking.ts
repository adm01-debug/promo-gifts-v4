import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface AllowedCountry {
  id: string;
  country_code: string;
  country_name: string;
  is_active: boolean;
  created_at: string;
}

interface GeoBlockingSettings {
  enabled: boolean;
  mode: 'whitelist' | 'blacklist';
}

export function useGeoBlocking() {
  const { user } = useAuth();
  const [countries, setCountries] = useState<AllowedCountry[]>([]);
  const [settings, setSettings] = useState<GeoBlockingSettings>({ enabled: false, mode: 'whitelist' });
  const [isLoading, setIsLoading] = useState(true);
  const [currentCountry, setCurrentCountry] = useState<{ code: string; name: string } | null>(null);

  const fetchCurrentCountry = useCallback(async () => {
    try {
      const response = await fetch('https://ipapi.co/json/');
      const data = await response.json();
      setCurrentCountry({
        code: data.country_code,
        name: data.country_name,
      });
    } catch (error) {
      console.error('Error fetching current country:', error);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [countriesRes, settingsRes] = await Promise.all([
        supabase
          .from('geo_allowed_countries')
          .select('*')
          .order('country_name'),
        supabase
          .from('security_settings')
          .select('*')
          .eq('setting_key', 'geo_blocking')
          .single(),
      ]);

      if (countriesRes.error) throw countriesRes.error;
      setCountries(countriesRes.data || []);

      if (settingsRes.data) {
        const value = settingsRes.data.setting_value as GeoBlockingSettings;
        setSettings(value);
      }
    } catch (error) {
      console.error('Error fetching geo blocking data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentCountry();
    fetchData();
  }, [fetchCurrentCountry, fetchData]);

  const toggleEnabled = useCallback(async (enabled: boolean): Promise<{ success: boolean; error?: string }> => {
    try {
      const newSettings = { ...settings, enabled };
      const { error } = await supabase
        .from('security_settings')
        .update({ 
          setting_value: newSettings,
          updated_at: new Date().toISOString(),
          updated_by: user?.id 
        })
        .eq('setting_key', 'geo_blocking');

      if (error) throw error;
      setSettings(newSettings);
      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  }, [settings, user]);

  const addCountry = useCallback(async (
    countryCode: string,
    countryName: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: 'Usuário não autenticado' };
    }

    try {
      const { error } = await supabase
        .from('geo_allowed_countries')
        .insert({
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
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  }, [user, fetchData]);

  const removeCountry = useCallback(async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase
        .from('geo_allowed_countries')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchData();
      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  }, [fetchData]);

  const toggleCountry = useCallback(async (
    id: string,
    isActive: boolean
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase
        .from('geo_allowed_countries')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;
      await fetchData();
      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  }, [fetchData]);

  const isCountryAllowed = useCallback((countryCode: string): boolean => {
    if (!settings.enabled) return true;
    
    const activeCountries = countries.filter(c => c.is_active);
    if (activeCountries.length === 0) return true;
    
    return activeCountries.some(c => c.country_code.toUpperCase() === countryCode.toUpperCase());
  }, [settings.enabled, countries]);

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
