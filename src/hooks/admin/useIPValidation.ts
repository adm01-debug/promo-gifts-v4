import { logger } from '@/lib/logger';
import { useState, useCallback } from 'react';
import { getSupabaseClient } from '@/integrations/supabase/lazy-client';

interface IPValidationResult {
  isAllowed: boolean;
  currentIP: string | null;
  hasRestrictions: boolean;
  error?: string;
  reason?: string;
  details?: Record<string, unknown>;
}

export function useIPValidation() {
  const [isValidating, setIsValidating] = useState(false);

  // Buscar IP atual do usuário (Opcional - Edge Function já identifica via headers)
  const fetchCurrentIP = useCallback(async (): Promise<string | null> => {
    try {
      // Usar a nossa própria edge function que é mais confiável e contorna AdBlockers
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase.functions.invoke('get-visitor-info');
      if (error || !data?.ip) {
        logger.warn('Fallback to secondary IP identification');
        const ipCtrl = new AbortController();
        const ipTimeout = setTimeout(() => ipCtrl.abort(), 5000);
        const response = await fetch('https://api.ipify.org?format=json', {
          signal: ipCtrl.signal,
        })
          .catch(() => null)
          .finally(() => clearTimeout(ipTimeout));
        if (response) {
          const ipData = await response.json();
          return ipData.ip;
        }
        return null;
      }
      return data.ip;
    } catch (error) {
      logger.error('Error fetching current IP:', error);
      return null;
    }
  }, []);

  // Validar IP para um usuário específico (por email) - pré-login
  const validateIPForUser = useCallback(
    async (_email: string): Promise<IPValidationResult> => {
      try {
        const currentIP = await fetchCurrentIP();
        return {
          isAllowed: true, // Validação completa acontece após login via edge function
          currentIP,
          hasRestrictions: false,
        };
      } catch (error: unknown) {
        return {
          isAllowed: false,
          currentIP: null,
          hasRestrictions: false,
          error: error instanceof Error ? error.message : 'Erro desconhecido',
        };
      }
    },
    [fetchCurrentIP],
  );

  // Validar IP e cidade para usuário autenticado via edge function
  const validateIPForAuthenticatedUser = useCallback(
    async (_userId: string): Promise<IPValidationResult> => {
      setIsValidating(true);

      try {
        const currentIP = await fetchCurrentIP();

        if (!currentIP) {
          return {
            isAllowed: false,
            currentIP: null,
            hasRestrictions: false,
            error: 'Não foi possível identificar seu IP',
          };
        }

        // Chamar edge function validate-access
        const supabase = await getSupabaseClient();
        const { data, error } = await supabase.functions.invoke('validate-access', {
          body: {
            ip: currentIP,
            userAgent: navigator.userAgent,
          },
        });

        if (error) {
          logger.error('Error calling validate-access:', error);
          // Em caso de erro na validação, permitir acesso (fail-open)
          return {
            isAllowed: true,
            currentIP,
            hasRestrictions: false,
            error: error.message,
          };
        }

        if (!data) {
          return { isAllowed: true, currentIP, hasRestrictions: false };
        }

        const result = data as {
          allowed: boolean;
          reason: string;
          details?: Record<string, unknown>;
        };

        if (!result.allowed) {
          let errorMsg = 'Acesso negado';
          if (result.reason === 'ip_not_whitelisted') {
            errorMsg = `Seu IP (${currentIP}) não está autorizado para acessar o sistema.`;
          } else if (result.reason === 'city_not_whitelisted') {
            const details = result.details || {};
            errorMsg = `Acesso negado: sua localização (${details.detected_city || 'desconhecida'}) não está autorizada.`;
          } else if (result.reason === 'too_many_attempts') {
            const details = result.details || {};
            errorMsg = `IP bloqueado temporariamente por excesso de tentativas. Tente novamente em ${details.lockout_minutes || 15} minutos.`;
          }

          return {
            isAllowed: false,
            currentIP,
            hasRestrictions: true,
            error: errorMsg,
            reason: result.reason,
            details: result.details,
          };
        }

        return {
          isAllowed: true,
          currentIP,
          hasRestrictions: result.reason !== 'no_settings',
        };
      } catch (error: unknown) {
        logger.error('Error in IP validation:', error);
        // Fail-open: se não conseguir validar, permite
        return {
          isAllowed: true,
          currentIP: null,
          hasRestrictions: false,
          error: error instanceof Error ? error.message : 'Erro desconhecido',
        };
      } finally {
        setIsValidating(false);
      }
    },
    [fetchCurrentIP],
  );

  // Registrar tentativa de login
  const logLoginAttempt = useCallback(
    async (
      email: string,
      userId: string | null,
      success: boolean,
      failureReason?: string,
    ): Promise<void> => {
      try {
        const currentIP = await fetchCurrentIP();

        const supabase = await getSupabaseClient();
        await supabase.functions.invoke('log-login-attempt', {
          body: {
            email,
            user_id: userId,
            ip_address: currentIP || 'unknown',
            success,
            failure_reason: failureReason || null,
            user_agent: navigator.userAgent,
          },
        });
      } catch (error) {
        logger.error('Error logging login attempt:', error);
      }
    },
    [fetchCurrentIP],
  );

  return {
    isValidating,
    fetchCurrentIP,
    validateIPForUser,
    validateIPForAuthenticatedUser,
    logLoginAttempt,
  };
}
