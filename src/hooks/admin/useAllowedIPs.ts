import { logger } from '@/lib/logger';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { untypedFrom } from '@/lib/supabase-untyped';

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

  /**
   * BUG-22 FIX: mountedRef + AbortController para fetchCurrentIP/fetchAllowedIPs.
   *
   * PROBLEMA ORIGINAL: fetchCurrentIP fazia fetch externo a api.ipify.org sem
   * AbortController nem flag de isMounted. Se o componente desmontasse durante
   * o round-trip (~200-500ms), setCurrentIP era chamado num componente desmontado.
   * fetchAllowedIPs também não tinha guard de isMounted.
   *
   * SOLUÇÃO:
   *   - fetchCurrentIP aceita AbortSignal opcional; silencia AbortError.
   *   - mountedRef sincronizado no useEffect garante que nenhum setter é chamado
   *     após o unmount.
   */
  const mountedRef = useRef(true);

  // Buscar IP atual do usuário
  const fetchCurrentIP = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch('https://api.ipify.org?format=json', { signal });
      const data = (await response.json()) as { ip: string };
      if (mountedRef.current) setCurrentIP(data.ip);
    } catch (error) {
      // AbortError é esperado no unmount — silenciar
      if (error instanceof Error && error.name === 'AbortError') return;
      logger.error('Error fetching current IP:', error);
    }
  }, []); // mountedRef é estável (não precisa nas deps)

  const fetchAllowedIPs = useCallback(async () => {
    if (!userId) {
      if (mountedRef.current) {
        setAllowedIPs([]);
        setIsLoading(false);
      }
      return;
    }

    try {
      const { data, error } = await untypedFrom('user_ip_allowlist')
        .select('id, user_id, ip_address, label, is_active, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (!mountedRef.current) return; // BUG-22 FIX: guard pós-await
      if (error) throw error;
      setAllowedIPs((data || []) as AllowedIP[]);
    } catch (error) {
      logger.error('Error fetching allowed IPs:', error);
    } finally {
      if (mountedRef.current) setIsLoading(false); // BUG-22 FIX: só se montado
    }
  }, [userId]); // mountedRef é estável

  useEffect(() => {
    mountedRef.current = true;
    const controller = new AbortController();
    fetchCurrentIP(controller.signal); // BUG-22 FIX: passa signal para poder abortar
    fetchAllowedIPs();
    return () => {
      mountedRef.current = false; // BUG-22 FIX: sinaliza unmount
      controller.abort();
    };
  }, [fetchCurrentIP, fetchAllowedIPs]);

  const addIP = useCallback(
    async (ipAddress: string, label?: string): Promise<{ success: boolean; error?: string }> => {
      if (!userId || !user) {
        return { success: false, error: 'Usuário não autenticado' };
      }

      try {
        const { error } = await untypedFrom('user_ip_allowlist').insert({
          user_id: userId,
          ip_address: ipAddress,
          label: label || null,
          created_by: user.id,
        });

        if (error) {
          const e = error as { code?: string };
          if (e.code === '23505') {
            return { success: false, error: 'Este IP já está cadastrado' };
          }
          throw error;
        }

        await fetchAllowedIPs();
        return { success: true };
      } catch (error: unknown) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Erro desconhecido',
        };
      }
    },
    [userId, user, fetchAllowedIPs],
  );

  const removeIP = useCallback(
    async (ipId: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const { error } = await untypedFrom('user_ip_allowlist').delete().eq('id', ipId);

        if (error) throw error;

        await fetchAllowedIPs();
        return { success: true };
      } catch (error: unknown) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Erro desconhecido',
        };
      }
    },
    [fetchAllowedIPs],
  );

  const toggleIP = useCallback(
    async (ipId: string, isActive: boolean): Promise<{ success: boolean; error?: string }> => {
      try {
        const { error } = await untypedFrom('user_ip_allowlist')
          .update({ is_active: isActive })
          .eq('id', ipId);

        if (error) throw error;

        await fetchAllowedIPs();
        return { success: true };
      } catch (error: unknown) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Erro desconhecido',
        };
      }
    },
    [fetchAllowedIPs],
  );

  const isIPAllowed = useCallback(
    (ip: string): boolean => {
      // Se não há IPs configurados, permitir todos
      if (allowedIPs.length === 0) return true;

      // Verificar se o IP está na lista de permitidos ativos
      return allowedIPs.some((allowedIP) => allowedIP.is_active && allowedIP.ip_address === ip);
    },
    [allowedIPs],
  );

  const hasIPRestriction = useMemo(
    () => allowedIPs.filter((ip) => ip.is_active).length > 0,
    [allowedIPs],
  );

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
