// src/lib/sw-register.ts

import { logger } from '@/lib/logger';

/**
 * Registra Service Worker para PWA
 *
 * Deve ser chamado no main.tsx após setupLocale()
 */
export async function registerServiceWorker(): Promise<void> {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      logger.log('✅ Service Worker registrado:', registration.scope);

      // Checar atualizações
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              logger.log('🔄 Nova versão do Service Worker disponível');
              // Reload automático removido para evitar auto-refresh intermitente
            }
          });
        }
      });

      // Controllerchange listener removido para evitar auto-refresh
      logger.log('✅ Service Worker configurado sem auto-reload');
    } catch (error) {
      logger.error('❌ Falha ao registrar Service Worker:', error);
    }
  } else {
    logger.warn('⚠️ Service Workers não suportados neste navegador');
  }
}

/**
 * Desregistra Service Worker (útil para debug)
 */
export async function unregisterServiceWorker(): Promise<void> {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      await registration.unregister();
      logger.log('🗑️ Service Worker desregistrado');
    }
  }
}

/**
 * Verifica se app está instalado como PWA
 */
export function isPWA(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
  );
}

/**
 * Solicita permissão para notificações (para futura implementação)
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    logger.warn('⚠️ Notificações não suportadas');
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission;
  }

  return Notification.permission;
}
