import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

interface NotificationPermissionState {
  permission: NotificationPermission;
  isSupported: boolean;
  isEnabled: boolean;
}

// `vibrate` faz parte da Notification API em runtime, mas foi removido do
// tipo padrão `NotificationOptions` do lib.dom. Estendemos localmente.
interface ExtendedNotificationOptions extends NotificationOptions {
  vibrate?: number[];
}

const SECURITY_ALERT_ICONS: Record<string, string> = {
  info: '🔵',
  warning: '🟡',
  critical: '🔴',
} as const;

export function usePushNotifications() {
  const { user } = useAuth();
  const [state, setState] = useState<NotificationPermissionState>({
    permission: 'default',
    isSupported: false,
    isEnabled: false,
  });

  useEffect(() => {
    const isSupported = 'Notification' in window;
    setState((prev) => ({
      ...prev,
      isSupported,
      permission: isSupported ? Notification.permission : 'denied',
      isEnabled: isSupported && Notification.permission === 'granted',
    }));
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported) {
      logger.warn('Push notifications not supported');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setState((prev) => ({
        ...prev,
        permission,
        isEnabled: permission === 'granted',
      }));

      if (permission === 'granted') {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [state.isSupported]);

  const showNotification = useCallback(
    (title: string, options?: NotificationOptions) => {
      if (!state.isEnabled) {
        return null;
      }
      // Re-check live permission — state.isEnabled may be stale if the user
      // revoked permission in browser settings after we last synced.
      if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
        return null;
      }

      try {
        const notificationOptions: ExtendedNotificationOptions = {
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          vibrate: [200, 100, 200],
          ...options,
        };
        const notification = new Notification(title, notificationOptions);

        notification.onclick = () => {
          window.focus();
          notification.close();
        };

        return notification;
      } catch (error) {
        logger.error('Error showing notification:', error);
        return null;
      }
    },
    [state.isEnabled],
  );

  const showSecurityAlert = useCallback(
    (title: string, message: string, type: 'info' | 'warning' | 'critical' = 'warning') => {
      return showNotification(`${SECURITY_ALERT_ICONS[type]} ${title}`, {
        body: message,
        tag: 'security-alert',
        requireInteraction: type === 'critical',
        silent: type === 'info',
      });
    },
    [showNotification],
  );

  // Subscribe to real-time security notifications
  useEffect(() => {
    if (!user || !state.isEnabled) return;

    const channel = supabase
      .channel('security-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const notification = payload.new as {
            title: string;
            message: string;
            type: string;
          };

          if (notification.type === 'security') {
            showSecurityAlert(notification.title, notification.message, 'warning');
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'device_login_notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const deviceNotif = payload.new as {
            ip_address: string;
            location: string | null;
          };

          showSecurityAlert(
            'Novo login detectado',
            `Login de ${deviceNotif.ip_address}${deviceNotif.location ? ` (${deviceNotif.location})` : ''}`,
            'warning',
          );
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'login_attempts',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const attempt = payload.new as {
            success: boolean;
            ip_address: string;
            failure_reason: string | null;
          };

          if (!attempt.success) {
            showSecurityAlert(
              'Tentativa de login falha',
              `Tentativa de ${attempt.ip_address}: ${attempt.failure_reason || 'Credenciais inválidas'}`,
              'critical',
            );
          }
        },
      )
      .subscribe((status, err) => {
        if ((status as string) === 'CHANNEL_ERROR' || (status as string) === 'TIMED_OUT') {
          logger.warn('[usePushNotifications] security realtime channel error', { status, err });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, state.isEnabled, showSecurityAlert]);

  return {
    ...state,
    requestPermission,
    showNotification,
    showSecurityAlert,
  };
}
