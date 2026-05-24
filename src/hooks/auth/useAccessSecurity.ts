import { useState, useEffect, useCallback } from 'react';
import { type createClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Tables not yet in generated schema — bypass type checking via raw client cast
const db = supabase as unknown as ReturnType<typeof createClient>;

export interface IpWhitelistEntry {
  id: string;
  ip_address: string;
  label: string | null;
  is_active: boolean;
  created_at: string;
}

export interface CityWhitelistEntry {
  id: string;
  city_name: string;
  state: string | null;
  country_code: string;
  is_active: boolean;
  created_at: string;
}

export interface AccessBlockedLog {
  id: string;
  email: string | null;
  ip_address: string;
  city: string | null;
  state: string | null;
  country: string | null;
  block_reason: string;
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
  const [cities, setCities] = useState<CityWhitelistEntry[]>([]);
  const [blockedLogs, setBlockedLogs] = useState<AccessBlockedLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [settingsRes, ipsRes, citiesRes, logsRes] = await Promise.all([
        db.from('access_security_settings').select('*').limit(1).single(),
        db.from('ip_whitelist').select('*').order('created_at', { ascending: false }),
        db.from('city_whitelist').select('*').order('created_at', { ascending: false }),
        db
          .from('access_blocked_log')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      const settingsData = (settingsRes as unknown as { data: AccessSecuritySettings | null }).data;
      if (settingsData) setSettings(settingsData);
      if (ipsRes.data) setIps(ipsRes.data as IpWhitelistEntry[]);
      if (citiesRes.data) setCities(citiesRes.data as CityWhitelistEntry[]);
      if (logsRes.data) setBlockedLogs(logsRes.data as AccessBlockedLog[]);
    } catch (error) {
      console.error('Erro ao carregar configurações de acesso:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const updateSettings = async (updates: Partial<AccessSecuritySettings>) => {
    if (!settings) return;
    const { error } = await db
      .from('access_security_settings')
      .update(updates as Record<string, unknown>)
      .eq('id', settings.id);
    if (error) {
      toast.error('Erro ao atualizar configurações');
      return;
    }
    setSettings({ ...settings, ...updates });
    toast.success('Configurações atualizadas');
  };

  const addIp = async (ip_address: string, label?: string) => {
    const { data, error } = await db
      .from('ip_whitelist')
      .insert({ ip_address, label: label || null } as never)
      .select()
      .single();
    if (error) {
      if ((error as { code?: string }).code === '23505') toast.error('IP já cadastrado');
      else toast.error('Erro ao adicionar IP');
      return false;
    }
    setIps((prev) => [data as IpWhitelistEntry, ...prev]);
    toast.success('IP adicionado à whitelist');
    return true;
  };

  const removeIp = async (id: string) => {
    const { error } = await db.from('ip_whitelist').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao remover IP');
      return;
    }
    setIps((prev) => prev.filter((ip) => ip.id !== id));
    toast.success('IP removido');
  };

  const toggleIp = async (id: string, is_active: boolean) => {
    const { error } = await db.from('ip_whitelist').update({ is_active }).eq('id', id);
    if (error) {
      toast.error('Erro ao atualizar IP');
      return;
    }
    setIps((prev) => prev.map((ip) => (ip.id === id ? { ...ip, is_active } : ip)));
  };

  const addCity = async (city_name: string, state?: string, country_code = 'BR') => {
    const { data, error } = await db
      .from('city_whitelist')
      .insert({ city_name, state: state || null, country_code } as never)
      .select()
      .single();
    if (error) {
      if ((error as { code?: string }).code === '23505') toast.error('Cidade já cadastrada');
      else toast.error('Erro ao adicionar cidade');
      return false;
    }
    setCities((prev) => [data as CityWhitelistEntry, ...prev]);
    toast.success('Cidade adicionada à whitelist');
    return true;
  };

  const removeCity = async (id: string) => {
    const { error } = await db.from('city_whitelist').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao remover cidade');
      return;
    }
    setCities((prev) => prev.filter((c) => c.id !== id));
    toast.success('Cidade removida');
  };

  const toggleCity = async (id: string, is_active: boolean) => {
    const { error } = await db.from('city_whitelist').update({ is_active }).eq('id', id);
    if (error) {
      toast.error('Erro ao atualizar cidade');
      return;
    }
    setCities((prev) => prev.map((c) => (c.id === id ? { ...c, is_active } : c)));
  };

  return {
    settings,
    ips,
    cities,
    blockedLogs,
    isLoading,
    updateSettings,
    addIp,
    removeIp,
    toggleIp,
    addCity,
    removeCity,
    toggleCity,
    refetch: fetchAll,
  };
}
