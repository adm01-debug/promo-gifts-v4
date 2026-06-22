// src/lib/sw-register.ts

import { logger } from '@/lib/logger';

// Guard: prevents concurrent reload loops if multiple SW_STALE_CHUNK messages arrive.
let _staleChunkReloadScheduled = false;

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
              // Reload automático removido para evitar auto-refresh intermitente.
              // O SW v3.2.0 usa Network First para navegação, garantindo HTML
              // atualizado sem precisar recarregar a aba atual.
            }
          });
        }
      });

      // ── SW_STALE_CHUNK recovery listener ──────────────────────────────────
      // Escuta mensagens do SW. Quando um chunk hashed retorna 404 do CDN
      // (deploy novo substituiu os hashes dos chunks), o SW:
      //   1. Invalida /index.html do cache
      //   2. Envia SW_STALE_CHUNK para todos os tabs abertos
      // Ao receber, recarregamos a página para obter o novo HTML com os
      // hashes corretos. O reload é throttled (no máximo 1 vez por 10s)
      // para evitar loops de refresh em caso de problemas persistentes.
      //
      // Diferença vs. controllerchange: este reload só ocorre quando o
      // app está QUEBRADO (chunk 404), não em toda atualização do SW.
      navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
        if (event.data?.type === 'SW_STALE_CHUNK') {
          logger.log(
            '🔄 [SW] Chunk desatualizado detectado — recarregando para obter chunks atualizados:',
            event.data.url,
          );
          // Throttle: apenas 1 reload por 10s para evitar loops.
          if (!_staleChunkReloadScheduled) {
            _staleChunkReloadScheduled = true;
            // Aguarda 300ms para deixar o React registrar o erro (se houver)
            // antes do reload. Isso facilita a depuração em logs de Sentry.
            setTimeout(() => {
              window.location.reload();
            }, 300);
            // Reset do guard após 10s (caso o reload falhe por alguma razão)
            setTimeout(() => {
              _staleChunkReloadScheduled = false;
            }, 10_000);
          }
        }
      });

      logger.log('✅ Service Worker configurado: Network First + stale chunk recovery ativo');
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
