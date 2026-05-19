import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface AllowedIP {
  id: string;
  user_id: string;
  ip_address: string;
  label: string | null;
  is_active: boolean;
  created_at: string;
}

export function useAllowedIPs(targetUserId?: string) {
  const { user } = useAuth();
  const [allowedIPs, setAllowedIPs] = useState<AllowedIP[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentIP, setCurrentIP] = useState<string | null>(null);

  const userId = targetUserId || user?.id;

  // Buscar IP atual do usuário
  const fetchCurrentIP = useCallback(async () => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      setCurrentIP(data.ip);
    } catch (error) {
      console.error('Error fetching current IP:', error);
    }
  }, []);

  const fetchAllowedIPs = useCallback(async () => {
    if (!userId) {
      setAllowedIPs([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_allowed_ips')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAllowedIPs(data || []);
    } catch (error) {
      console.error('Error fetching allowed IPs:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchCurrentIP();
    fetchAllowedIPs();
  }, [fetchCurrentIP, fetchAllowedIPs]);

  const addIP = useCallback(async (
    ipAddress: string, 
    label?: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!userId || !user) {
      return { success: false, error: 'Usuário não autenticado' };
    }

    try {
      const { error } = await supabase
        .from('user_allowed_ips')
        .insert({
          user_id: userId,
          ip_address: ipAddress,
          label: label || null,
          created_by: user.id,
        });

      if (error) {
        if (error.code === '23505') {
          return { success: false, error: 'Este IP já está cadastrado' };
        }
        throw error;
      }

      await fetchAllowedIPs();
      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  }, [userId, user, fetchAllowedIPs]);

  const removeIP = useCallback(async (
    ipId: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase
        .from('user_allowed_ips')
        .delete()
        .eq('id', ipId);

      if (error) throw error;

      await fetchAllowedIPs();
      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  }, [fetchAllowedIPs]);

  const toggleIP = useCallback(async (
    ipId: string, 
    isActive: boolean
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase
        .from('user_allowed_ips')
        .update({ is_active: isActive })
        .eq('id', ipId);

      if (error) throw error;

      await fetchAllowedIPs();
      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  }, [fetchAllowedIPs]);

  const isIPAllowed = useCallback((ip: string): boolean => {
    // Se não há IPs configurados, permitir todos
    if (allowedIPs.length === 0) return true;
    
    // Verificar se o IP está na lista de permitidos ativos
    return allowedIPs.some(
      allowedIP => allowedIP.is_active && allowedIP.ip_address === ip
    );
  }, [allowedIPs]);

  const hasIPRestriction = allowedIPs.filter(ip => ip.is_active).length > 0;

  return {
    allowedIPs,
    isLoading,
    currentIP,
    hasIPRestriction,
    addIP,
    removeIP,
    toggleIP,
    isIPAllowed,
    refetch: fetchAllowedIPs,
  };
}
