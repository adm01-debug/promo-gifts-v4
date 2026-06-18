import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import * as OTPAuth from 'otpauth';
import { untypedFrom } from '@/lib/supabase-untyped';

import { logger } from '@/lib/logger';
interface TwoFactorSettings {
  id: string;
  user_id: string;
  is_enabled: boolean;
  enabled_at: string | null;
  created_at: string;
}

export function use2FA(targetUserId?: string) {
  const { user } = useAuth();
  const effectiveUserId = targetUserId || user?.id;
  const [settings, setSettings] = useState<TwoFactorSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingSecret, setPendingSecret] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    if (!effectiveUserId) {
      setSettings(null);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await untypedFrom('user_2fa_settings')
        .select('id, user_id, is_enabled, enabled_at, created_at')
        .eq('user_id', effectiveUserId)
        .maybeSingle();

      if (error) throw error;
      setSettings(data as TwoFactorSettings | null);
    } catch (error) {
      logger.error('Error fetching 2FA settings:', error);
    } finally {
      setIsLoading(false);
    }
  }, [effectiveUserId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const generateSecret = useCallback((email: string): { secret: string; uri: string } => {
    const totp = new OTPAuth.TOTP({
      issuer: 'Promo Gifts',
      label: email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: new OTPAuth.Secret({ size: 20 }),
    });

    const secret = totp.secret.base32;
    const uri = totp.toString();

    setPendingSecret(secret);
    return { secret, uri };
  }, []);

  const verifyToken = useCallback((secret: string, token: string): boolean => {
    try {
      const totp = new OTPAuth.TOTP({
        issuer: 'Promo Gifts',
        label: 'user',
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(secret),
      });

      const delta = totp.validate({ token, window: 1 });
      return delta !== null;
    } catch {
      return false;
    }
  }, []);

  const enable2FA = useCallback(
    async (token: string): Promise<{ success: boolean; error?: string }> => {
      if (!effectiveUserId || !pendingSecret) {
        return { success: false, error: 'Nenhum secret pendente' };
      }

      if (!verifyToken(pendingSecret, token)) {
        return { success: false, error: 'Codigo invalido' };
      }

      try {
        const backupCodes = Array.from({ length: 8 }, () =>
          Math.random().toString(36).slice(2, 10).toUpperCase(),
        );

        const { error } = await untypedFrom('user_2fa_settings').upsert({
          user_id: effectiveUserId,
          totp_secret: pendingSecret,
          is_enabled: true,
          backup_codes: backupCodes,
          enabled_at: new Date().toISOString(),
        });

        if (error) throw error;

        setPendingSecret(null);
        await fetchSettings();

        return { success: true };
      } catch (error: unknown) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Erro desconhecido',
        };
      }
    },
    [effectiveUserId, pendingSecret, verifyToken, fetchSettings],
  );

  const disable2FA = useCallback(
    async (token?: string): Promise<{ success: boolean; error?: string }> => {
      if (!effectiveUserId) {
        return { success: false, error: 'Usuario nao autenticado' };
      }

      // Admin bypass: pode desativar sem token se targetUserId for explicito
      if (!token && !targetUserId) {
        return { success: false, error: 'Código necessário' };
      }

      /**
       * BUG-10 FIX: Delegar verificacao do token para o servidor.
       *
       * PROBLEMA ORIGINAL: `disable2FA` buscava `totp_secret` via SELECT e verificava
       * o TOTP token no cliente. O secret chegava em plaintext na resposta de rede,
       * expondo-o a ataques XSS -- qualquer script injetado podia captura-lo e gerar
       * tokens validos indefinidamente.
       *
       * SOLUCAO: a verificacao e feita inteiramente na Edge Function `verify-2fa-token`
       * (action: "disable"). O secret NUNCA chega ao cliente.
       *
       * PRE-REQUISITO: deploy da Edge Function `verify-2fa-token` com suporte a action
       * "disable". Enquanto nao deployada, a funcao retornara erro e disable2FA falhara
       * graciosamente com mensagem de erro ao inves de expor o secret.
       */
      try {
        const { data, error } = await supabase.functions.invoke('verify-2fa-token', {
          body: {
            action: 'disable',
            target_user_id: effectiveUserId,
            token: token ?? null,
            is_admin_bypass: !!targetUserId && !token,
          },
        });

        if (error || !data?.success) {
          return {
            success: false,
            error: data?.error || 'Codigo invalido ou erro ao desabilitar 2FA',
          };
        }

        await fetchSettings();
        return { success: true };
      } catch (error: unknown) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Erro desconhecido',
        };
      }
    },
    [effectiveUserId, targetUserId, fetchSettings],
  );

  return {
    settings,
    isLoading,
    is2FAEnabled: settings?.is_enabled ?? false,
    pendingSecret,
    generateSecret,
    verifyToken,
    enable2FA,
    disable2FA,
    refetch: fetchSettings,
  };
}
