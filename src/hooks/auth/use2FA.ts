import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import * as OTPAuth from 'otpauth';

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
      const { data, error } = await supabase
        .from('user_2fa_settings')
        .select('id, user_id, is_enabled, enabled_at, created_at')
        .eq('user_id', effectiveUserId)
        .maybeSingle();

      if (error) throw error;
      setSettings(data);
    } catch (error) {
      console.error('Error fetching 2FA settings:', error);
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

  const enable2FA = useCallback(async (token: string): Promise<{ success: boolean; error?: string }> => {
    if (!effectiveUserId || !pendingSecret) {
      return { success: false, error: 'Nenhum secret pendente' };
    }

    // Verificar token antes de salvar
    if (!verifyToken(pendingSecret, token)) {
      return { success: false, error: 'Código inválido' };
    }

    try {
      // Gerar códigos de backup
      const backupCodes = Array.from({ length: 8 }, () => 
        Math.random().toString(36).substring(2, 10).toUpperCase()
      );

      const { error } = await supabase
        .from('user_2fa_settings')
        .upsert({
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
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  }, [effectiveUserId, pendingSecret, verifyToken, fetchSettings]);

  const disable2FA = useCallback(async (token?: string): Promise<{ success: boolean; error?: string }> => {
    if (!effectiveUserId) {
      return { success: false, error: 'Usuário não autenticado' };
    }

    try {
      // Buscar secret atual
      const { data: currentSettings } = await supabase
        .from('user_2fa_settings')
        .select('totp_secret')
        .eq('user_id', effectiveUserId)
        .single();

      if (!currentSettings?.totp_secret) {
        return { success: false, error: '2FA não está habilitado' };
      }

      // Se token fornecido, verificar. Admin pode desativar sem token se targetUserId diferente
      if (token) {
        if (!verifyToken(currentSettings.totp_secret, token)) {
          return { success: false, error: 'Código inválido' };
        }
      } else if (!targetUserId) {
        return { success: false, error: 'Código necessário' };
      }

      const { error } = await supabase
        .from('user_2fa_settings')
        .update({
          is_enabled: false,
          totp_secret: null,
          backup_codes: null,
          enabled_at: null,
        })
        .eq('user_id', effectiveUserId);

      if (error) throw error;

      await fetchSettings();
      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  }, [effectiveUserId, targetUserId, verifyToken, fetchSettings]);

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
