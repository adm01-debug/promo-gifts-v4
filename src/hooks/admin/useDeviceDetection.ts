import { logger } from '@/lib/logger';
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { untypedFrom } from '@/lib/supabase-untyped';

interface DeviceInfo {
  fingerprint: string;
  userAgent: string;
  browserName: string;
  osName: string;
  deviceType: string;
}

function generateDeviceFingerprint(): string {
  const components = [
    navigator.userAgent,
    navigator.language,
    navigator.platform,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 'unknown',
    (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 'unknown',
  ];

  const fingerprint = components.join('|');

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }

  return Math.abs(hash).toString(36);
}

function getBrowserName(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Edg')) return 'Edge';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Safari')) return 'Safari';
  if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera';
  return 'Unknown';
}

function getOSName(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Mac')) return 'macOS';
  if (ua.includes('Linux')) return 'Linux';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
  return 'Unknown';
}

function getDeviceType(): string {
  const ua = navigator.userAgent;
  if (/Mobi|Android/i.test(ua)) {
    if (/Tablet|iPad/i.test(ua)) return 'Tablet';
    return 'Mobile';
  }
  return 'Desktop';
}

function getDeviceInfo(): DeviceInfo {
  return {
    fingerprint: generateDeviceFingerprint(),
    userAgent: navigator.userAgent,
    browserName: getBrowserName(),
    osName: getOSName(),
    deviceType: getDeviceType(),
  };
}

export function useDeviceDetection(targetUserId?: string) {
  const { user } = useAuth();
  const effectiveUserId = targetUserId || user?.id;

  const checkDevice = useCallback(async (): Promise<{
    isNewDevice: boolean;
    isNewIP: boolean;
    error?: string;
  }> => {
    if (!user) {
      return { isNewDevice: false, isNewIP: false, error: 'No user logged in' };
    }

    try {
      const deviceInfo = getDeviceInfo();

      const { data, error } = await supabase.functions.invoke('detect-new-device', {
        body: {
          userId: user.id,
          userEmail: user.email,
          deviceInfo,
        },
      });

      if (error) {
        logger.error('Error checking device:', error);
        return { isNewDevice: false, isNewIP: false, error: error.message };
      }

      return {
        isNewDevice: data.isNewDevice || false,
        isNewIP: data.isNewIP || false,
      };
    } catch (error: unknown) {
      logger.error('Device detection error:', error);
      return {
        isNewDevice: false,
        isNewIP: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }, [user]);

  const getKnownDevices = useCallback(async () => {
    if (!effectiveUserId) return [];

    const { data, error } = await untypedFrom('user_known_devices')
      .select('*')
      .eq('user_id', effectiveUserId)
      .order('last_seen_at', { ascending: false });

    if (error) {
      logger.error('Error fetching known devices:', error);
      return [];
    }

    return data ?? [];
  }, [effectiveUserId]);

  const removeDevice = useCallback(
    async (deviceId: string): Promise<boolean> => {
      if (!effectiveUserId) return false;

      const { error } = await untypedFrom('user_known_devices')
        .delete()
        .eq('id', deviceId)
        .eq('user_id', effectiveUserId);

      if (error) {
        logger.error('Error removing device:', error);
        return false;
      }

      return true;
    },
    [effectiveUserId],
  );

  const trustDevice = useCallback(
    async (deviceId: string): Promise<boolean> => {
      if (!effectiveUserId) return false;

      const { error } = await untypedFrom('user_known_devices')
        .update({ is_trusted: true })
        .eq('id', deviceId)
        .eq('user_id', effectiveUserId);

      if (error) {
        logger.error('Error trusting device:', error);
        return false;
      }

      return true;
    },
    [effectiveUserId],
  );

  return {
    checkDevice,
    getKnownDevices,
    removeDevice,
    trustDevice,
    getDeviceInfo,
  };
}
