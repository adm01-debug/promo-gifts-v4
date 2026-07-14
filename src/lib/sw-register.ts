// src/lib/sw-register.ts

import { logger } from '@/lib/logger';
import { swConfirmedStaleUrls } from '@/lib/chunk-recovery';

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
          // BUG-CR-2 FIX: registra URL stale ANTES do reload para que
          // probeAsset() pule o HEAD request — eliminando as mensagens
          // "Falha ao carregar Buscar: HEAD" no DevTools do browser.
          // Race window: se lazyWithRetry.attemptChunkRecovery() disparar
          // antes do reload em 300ms, encontrará a URL no set e skip o probe.
          const staleUrl = event.data?.url as string | undefined;
          if (staleUrl) {
            swConfirmedStaleUrls.add(staleUrl);
            logger.log('[SW] chunk stale confirmado — URL registrada:', staleUrl);
          }
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
 * Verifica se app está instalado como PWA.
 *
 * BUG-SW-REG-1 FIX: window.navigator.standalone é uma propriedade não-standard
 * exclusiva do iOS Safari — TypeScript (TS2339) e Chrome DevTools a flagam como
 * inexistente no tipo Navigator. Fix: acesso via type assertion seguro.
 *
 * Cobre todos os modos PWA registrados no manifest.json:
 *  - standalone + minimal-ui (Android Chrome, Edge, Samsung Internet)
 *  - fullscreen          (algumas versões do Chrome)
 *  - window-controls-overlat�6�&��RFW6�F������f�vF�"�7F�F���R���26f&�(	B�:6��7F�F&B�6W76F�6��67B����W��'BgV�7F����5t���&���V���6��7B7F�F���UVW'�Тv��F�r��F6��VF��r�F�7�����FS�7F�F���R�r���F6�W2���v��F�r��F6��VF��r�F�7�����FS�֖����V��r���F6�W2���v��F�r��F6��VF��r�F�7�����FS�gV��67&VV�r���F6�W2���v��F�r��F6��VF��r�F�7�����FS�v��F�r�6��G&��2��fW&���r���F6�W3�������26f&���f�vF�"�7F�F���R:�&���V�V�F���7F�F�6���t���67B�V6W7<:&��&�&�VFFR�:6��7F�F&BW6V�FRF�F���f�vF�"E2�6��7B��57F�F���RТ&���V₇v��F�r��f�vF�"2V���v�2&V6�&C�7G&��r�V���v���7F�F���R����&WGW&�7F�F���UVW'�����57F�F���S��Р�򢠢�6�Ɩ6�FW&֗7<:6�&��F�f�6:|;VW2�&gWGW&���V�V�F:|:6���W��'B7��2gV�7F���&WVW7D��F�f�6F���W&֗76��ₓ�&�֗6S���F�f�6F���W&֗76�������b��t��F�f�6F���r��v��F�r������vvW"�v&�~)������F�f�6:|;VW2�:6�7W�'FF2r���&WGW&�vFV�VBs��Р��b���F�f�6F����W&֗76������vw&�FVBr���&WGW&�vw&�FVBs��Р��b���F�f�6F����W&֗76�����vFV�VBr���6��7BW&֗76����v�B��F�f�6F����&WVW7EW&֗76��ₓ��&WGW&�W&֗76��㰢Р�&WGW&���F�f�6F����W&֗76��㰧�