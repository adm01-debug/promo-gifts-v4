import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

interface NotificationPermissionState {
  permission: NotificationPermission;
  isSupported: boolean;
  isEnabled: boolean;
}

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

      try {
        const notification = new Notification(title, {
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          vibrate: [200, 100, 200],
          ...options,
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
        };

        return notification;
      } catch (error) {
        console.error('Error showing notification:', error);
        return null;
      }
    },
    [state.isEnabled],
  );

  const showSecurityAlert = useCallback(
    (title: string, message: string, type: 'info' | 'warning' | 'critical' = 'warning') => {
      const icons: Record<string, string> = {
        info: '🔵',
        warning: '🟡',
        critical: '🔴',
      };

      return showNotification(`${icons[type]} ${title}`, {
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
      .subscribe();

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
