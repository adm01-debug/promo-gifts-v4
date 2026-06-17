import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { untypedFrom } from '@/lib/supabase-untyped';

import { logger } from '@/lib/logger';
export interface IpWhitelistEntry {
  id: string;
  ip_address: string;
  reason: string | null;
  list_type: string;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface CountryWhitelistEntry {
  id: string;
  country_code: string;
  country_name: string;
  is_active: boolean | null;
  created_at: string | null;
}

export interface AccessBlockedLog {
  id: string;
  user_email: string | null;
  ip_address: string | null;
  error_message: string | null;
  operation: string;
  table_name: string;
  user_agent: string | null;
  created_at: string;
}

export interface AccessSecuritySettings {
  id: string;
  ip_whitelist_enabled: boolean;
  city_whitelist_enabled: boolean;
  block_unknown_locations: boolean;
  max_failed_attempts: number;
  lockout_duration_minutes: number;
}

export function useAccessSecurity() {
  const [settings, setSettings] = useState<AccessSecuritySettings | null>(null);
  const [ips, setIps] = useState<IpWhitelistEntry[]>([]);
  const [countries, setCountries] = useState<CountryWhitelistEntry[]>([]);
  const [blockedLogs, setBlockedLogs] = useState<AccessBlockedLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchAll = useCallback(async () => {
    if (!mountedRef.current) return;
    setIsLoading(true);
    try {
      const [settingsRes, ipsRes, countriesRes, logsRes] = await Promise.all([
        untypedFrom('access_security_settings')
          .select(
            'id, ip_whitelist_enabled, city_whitelist_enabled, block_unknown_locations, max_failed_attempts, lockout_duration_minutes',
          )
          .limit(1)
          .single(),
        untypedFrom('ip_access_control')
          .select('id, ip_address, list_type, reason, expires_at, created_at')
          .eq('list_type', 'allowlist')
          .order('created_at', { ascending: false }),
        untypedFrom('geo_allowed_countries')
          .select('id, country_code, country_name, is_active, created_at')
          .order('country_name', { ascending: true }),
        untypedFrom('rls_denial_log')
          .select(
            'id, user_email, ip_address, error_message, operation, table_name, user_agent, created_at',
          )
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      if (!mountedRef.current) return;

      const settingsData = (settingsRes as unknown as { data: AccessSecuritySettings | null }).data;
      if (settingsData) setSettings(settingsData);

      if (ipsRes.data) {
        const now = new Date().toISOString();
        setIps(
          (
            ipsRes.data as Array<{
              id: string;
              ip_address: string;
              list_type: string;
              reason: string | null;
              expires_at: string | null;
              created_at: string;
            }>
          ).map((row) => ({
            ...row,
            is_active: !row.expires_at || row.expires_at > now,
          })),
        );
      }

      if (countriesRes.data) setCountries(countriesRes.data as CountryWhitelistEntry[]);
      if (logsRes.data) setBlockedLogs(logsRes.data as AccessBlockedLog[]);
    } catch (error) {
      if (!mountedRef.current) return;
      logger.error('Erro ao carregar configurações de acesso:', error);
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const updateSettings = async (updates: Partial<AccessSecuritySettings>) => {
    if (!settings) return;
    const { error } = await untypedFrom('access_security_settings')
      .update(updates)
      .eq('id', settings.id);
    if (error) {
      toast.error('Erro ao atualizar configurações');
      return;
    }
    setSettings({ ...settings, ...updates });
    toast.success('Configurações atualizadas');
  };

  const addIp = async (ipAddress: string, reason?: string) => {
    const { data, error } = await untypedFrom('ip_access_control')
      .insert({ ip_address: ipAddress, list_type: 'allowlist', reason: reason || null })
      .select('id, ip_address, list_type, reason, expires_at, created_at')
      .single();
    if (error || !data) {
      if ((error as { code?: string })?.code === '23505') toast.error('IP já cadastrado');
      else toast.error('Erro ao adicionar IP');
      return false;
    }
    const now = new Date().toISOString();
    const entry = data as {
      id: string;
      ip_address: string;
      list_type: string;
      reason: string | null;
      expires_at: string | null;
      created_at: string;
    };
    setIps((prev) => [
      { ...entry, is_active: !entry.expires_at || entry.expires_at > now },
      ...prev,
    ]);
    toast.success('IP adicionado à whitelist');
    return true;
  };

  const removeIp = async (id: string) => {
    const { error } = await untypedFrom('ip_access_control').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao remover IP');
      return;
    }
    setIps((prev) => prev.filter((ip) => ip.id !== id));
    toast.success('IP removido');
  };

  const toggleIp = async (id: string, isActive: boolean) => {
    const expires_at = isActive ? null : new Date(0).toISOString();
    const { error } = await untypedFrom('ip_access_control').update({ expires_at }).eq('id', id);
    if (error) {
      toast.error('Erro ao atualizar IP');
      return;
    }
    setIps((prev) =>
      prev.map((ip) => (ip.id === id ? { ...ip, is_active: isActive, expires_at } : ip)),
    );
  };

  const addCountry = async (countryCode: string, countryName: string) => {
    const { data, error } = await untypedFrom('geo_allowed_countries')
      .insert({ country_code: countryCode, country_name: countryName })
      .select()
      .single();
    if (error || !data) {
      if ((error as { code?: string })?.code === '23505') toast.error('País já cadastrado');
      else toast.error('Erro ao adicionar país');
      return false;
    }
    setCountries((prev) => [data as CountryWhitelistEntry, ...prev]);
    toast.success('País adicionado à whitelist');
    return true;
  };

  const removeCountry = async (id: string) => {
    const { error } = await untypedFrom('geo_allowed_countries').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao remover país');
      return;
    }
    setCountries((prev) => prev.filter((c) => c.id !== id));
    toast.success('País removido');
  };

  const toggleCountry = async (id: string, isActive: boolean) => {
    const { error } = await untypedFrom('geo_allowed_countries')
      .update({ is_active: isActive })
      .eq('id', id);
    if (error) {
      toast.error('Erro ao atualizar país');
      return;
    }
    setCountries((prev) => prev.map((c) => (c.id === id ? { ...c, is_active: isActive } : c)));
  };

  return {
    settings,
    ips,
    countries,
    cities: countries,
    blockedLogs,
    isLoading,
    updateSettings,
    addIp,
    removeIp,
    toggleIp,
    addCity: (cityName: string, state?: string, countryCode = 'BR') =>
      addCountry(countryCode, cityName + (state ? `, ${state}` : '')),
    removeCity: removeCountry,
    toggleCity: toggleCountry,
    refetch: fetchAll,
  };
}
