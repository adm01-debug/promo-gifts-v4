/**
 * chunk-recovery — recuperação automática de falhas de carregamento de chunk.
 *
 * Cenário-alvo: o servidor Vite (ou o CDN à frente dele) responde 502/503/504
 * a um `import()` dinâmico. O navegador então fica com a versão antiga do
 * mapa de chunks em memória + cache HTTP "negativo" do asset que falhou.
 * Um simples `location.reload()` reusa o mesmo asset cached e a tela branca
 * volta. Esta camada:
 *
 *   1. Detecta erros de chunk de forma abrangente (texto + status HTTP).
 *   2. Aciona um "hard reload com cache-bust" — limpa Cache API, desregistra
 *      service workers e força novo download dos assets via `?_cb=`.
 *   3. Coalesce reloads dentro de 30s (no máximo 2 tentativas) usando
 *      sessionStorage; depois disso, devolve `false` para que o caller exiba
 *      uma tela de erro estável (sem loop infinito que vira tela branca).
 *   4. (Opcional) faz uma sondagem leve do mesmo URL para distinguir 502
 *      transitório de 502 persistente — isso reduz reloads desnecessários
 *      quando o servidor já voltou.
 *
 * Convenção: este módulo NÃO importa React. Pode ser chamado de qualquer
 * camada (helpers, error boundaries, error reporter).
 */

import { logger } from '@/lib/logger';
import NProgress from 'nprogress';

const STORAGE_KEY = '__chunk_recovery__';
const WINDOW_MS = 30_000;
const MAX_HARD_RELOADS = 2;

interface RecoveryState {
  attempts: number;
  firstAt: number;
  lastUrl?: string;
}

function readState(): RecoveryState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { attempts: 0, firstAt: 0 };
    const parsed = JSON.parse(raw) as RecoveryState;
    // Reset janela se passou tempo suficiente
    if (Date.now() - parsed.firstAt > WINDOW_MS) {
      return { attempts: 0, firstAt: 0 };
    }
    return parsed;
  } catch {
    return { attempts: 0, firstAt: 0 };
  }
}

function writeState(state: RecoveryState): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // sessionStorage indisponível (Safari privado / iframe sandbox) — ignora.
  }
}

/** Limpa o marcador. Chamado quando um chunk carrega com sucesso após reload. */
export function clearChunkRecoveryState(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignora
  }
}

/**
 * Identifica se um erro é falha de carregamento de chunk (mensagem ou status).
 * Aceita Error, Response, ou string.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;

  // Response de fetch direto (raro neste path mas suportado)
  if (typeof Response !== 'undefined' && error instanceof Response) {
    return error.status === 404 || error.status === 502 || error.status === 503 || error.status === 504; // 404: chunk removed in new deploy
  }

  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';

  if (!message) return false;

  // Use toLowerCase() for case-insensitive matching across browsers
  // (Firefox may capitalize: 'Error loading...' vs 'error loading...')
  const msgLower = message.toLowerCase();

  return (
    msgLower.includes('failed to fetch dynamically imported module') ||
    msgLower.includes('error loading dynamically imported module') ||
    msgLower.includes('loading chunk') ||
    msgLower.includes('chunkloaderror') ||
    msgLower.includes('importing a module script failed') ||
    msgLower.includes('unable to preload css') ||
    /\b(404|502|503|504)\b/.test(message) // 404: Chrome may include status in error.message
  );
}

/**
 * Sondagem leve: HEAD no mesmo asset que falhou, com cache-bust. Usado para
 * distinguir 502 transitório (servidor voltou) de 502 persistente.
 * Retorna true se o servidor parece OK (status 2xx/3xx), false caso contrário.
 */
async function probeAsset(url: string, timeoutMs = 3000): Promise<boolean> {
  if (typeof fetch === 'undefined') return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const bustUrl = appendCacheBust(url);
    const res = await fetch(bustUrl, {
      method: 'HEAD',
      cache: 'no-store',
      credentials: 'same-origin',
      signal: controller.signal,
    });
    return res.ok || (res.status >= 300 && res.status < 400);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function appendCacheBust(url: string): string {
  try {
    const u = new URL(url, window.location.origin);
    u.searchParams.set('_cb', String(Date.now()));
    return u.toString();
  } catch {
    return `${url}${url.includes('?') ? '&' : '?'}_cb=${Date.now()}`;
  }
}

/**
 * Tenta extrair a URL do chunk que falhou a partir da mensagem de erro do
 * Vite/Rollup. Vite costuma incluir o caminho no formato:
 *   "Failed to fetch dynamically imported module: https://.../assets/foo-abc.js"
 */
export function extractChunkUrl(error: unknown): string | undefined {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  if (!message) return undefined;
  const match = /https?:\/\/[^\s)'"]+/.exec(message);
  return match?.[0];
}

/**
 * Limpa caches do navegador que possam estar segurando assets quebrados:
 *  - Cache API (usado por Service Workers / PWA)
 *  - Service Workers registrados (eles podem estar servindo o asset 502 do cache)
 *
 * Não limpa localStorage/sessionStorage — o estado da app é preservado.
 */
async function purgeBrowserAssetCaches(): Promise<void> {
  // 1. Cache API
  if (typeof caches !== 'undefined') {
    try {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n).catch(() => false)));
    } catch (e) {
      logger.warn('[chunk-recovery] caches.keys/delete falhou', { error: String(e) });
    }
  }

  // 2. Service Workers
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
    } catch (e) {
      logger.warn('[chunk-recovery] serviceWorker.getRegistrations falhou', {
        error: String(e),
      });
    }
  }
}

/**
 * Executa um hard reload: bypassa cache HTTP e descarta caches de SW.
 * Usa um query param de cache-bust no URL atual para garantir que o HTML
 * principal seja revalidado (e portanto o novo manifest de chunks seja lido).
 */
async function hardReload(): Promise<void> {
  await purgeBrowserAssetCaches();
  try {
    const u = new URL(window.location.href);
    u.searchParams.set('_cb', String(Date.now()));
    window.location.replace(u.toString());
  } catch {
    window.location.reload();
  }
}

/**
 * Tenta recuperar de uma falha de chunk.
 *
 * Retorna `true` se acionou um reload (o caller deve exibir um placeholder
 * neutro enquanto aguarda a navegação) ou `false` se o limite de tentativas
 * foi atingido — neste caso o caller deve mostrar tela de erro estável.
 *
 * Idempotente: chamadas repetidas dentro da janela só incrementam o contador
 * sem disparar reloads múltiplos simultâneos.
 */
let inFlight: Promise<boolean> | null = null;

export function attemptChunkRecovery(error: unknown): Promise<boolean> {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const state = readState();
    const now = Date.now();
    const firstAt = state.firstAt || now;
    const attempts = state.attempts + 1;

    // Atualiza estado ANTES do reload para o próximo ciclo conhecer o histórico.
    writeState({
      attempts,
      firstAt,
      lastUrl: extractChunkUrl(error),
    });

    if (attempts > MAX_HARD_RELOADS) {
      logger.error('[chunk-recovery] limite de hard-reloads atingido — exibindo tela de erro', {
        attempts,
        windowMs: WINDOW_MS,
      });
      NProgress.done();
      return false;
    }

    const url = extractChunkUrl(error);
    logger.warn('[chunk-recovery] disparando hard reload', {
      attempt: attempts,
      max: MAX_HARD_RELOADS,
      url,
    });

    // Progress feedback before reload
    NProgress.set(0.8);
    NProgress.start();

    // Sonda opcional: se conseguimos a URL e ela ainda está down,
    // espera um pouco mais antes de recarregar (back-off curto).
    if (url) {
      const ok = await probeAsset(url);
      if (!ok) {
        const backoffMs = 500 * attempts;
        logger.warn(
          `[chunk-recovery] asset ainda indisponível, aguardando ${backoffMs}ms antes do reload`,
        );
        await new Promise((r) => {
          setTimeout(r, backoffMs);
        });
      }
    }

    await hardReload();
    return true;
  })();

  return inFlight;
}

/**
 * Hook de bootstrap — chamado uma vez no startup da app. Limpa o marcador
 * caso o app tenha bootado com sucesso (significa que o reload anterior
 * resolveu o problema).
 */
export function markBootSuccessful(): void {
  // Pequeno delay garante que módulos lazy iniciais já carregaram.
  if (typeof window === 'undefined') return;
  window.setTimeout(() => {
    const state = readState();
    if (state.attempts > 0) {
      logger.info('[chunk-recovery] boot bem-sucedido após reload — limpando estado', {
        previousAttempts: state.attempts,
      });
    }
    clearChunkRecoveryState();
  }, 5_000);
}
