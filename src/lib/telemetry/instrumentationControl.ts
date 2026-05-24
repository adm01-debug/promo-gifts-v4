/**
 * Kill-switch global para a instrumentação client-side (bridge metrics +
 * long task watchdog + estimativa de payload).
 *
 * Quando "pausado":
 *  - `recordBridgeCall` vira no-op (zero push, zero notify).
 *  - `estimatePayloadBytes` retorna 0 sem stringify (evita parsing pesado).
 *  - O PerformanceObserver de longtask é desconectado.
 *
 * Permite verificar, sem recarregar a página, se a instrumentação é a
 * responsável por lentidão percebida durante a navegação.
 *
 * Persistência via localStorage para sobreviver a F5.
 * Contrato explícito:
 *  - '1' => pausado
 *  - '0' => ativo
 */

const STORAGE_KEY = 'lov:instrumentation:paused';

let paused = (() => {
  try {
    if (typeof localStorage === 'undefined') return true;
    const v = localStorage.getItem(STORAGE_KEY);
    // Kill-switch FORÇADO: default = pausado. Para reativar, set '0' explicitamente.
    // Valores ausentes/inválidos convergem para '1' (pausado).
    if (v === '0') return false;
    if (v !== '1') {
      try {
        localStorage.setItem(STORAGE_KEY, '1');
      } catch {
        /* noop */
      }
    }
    return true;
  } catch {
    return true;
  }
})();

const listeners = new Set<() => void>();

export function isInstrumentationPaused(): boolean {
  return paused;
}

export function setInstrumentationPaused(next: boolean): void {
  if (paused === next) return;
  paused = next;
  try {
    localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
  } catch {
    /* noop */
  }
  // Notifica para que watchdog reaja (start/stop) e UI re-renderize.
  for (const l of listeners) {
    try {
      l();
    } catch {
      /* noop */
    }
  }
}

export function toggleInstrumentationPaused(): boolean {
  setInstrumentationPaused(!paused);
  return paused;
}

export function subscribeInstrumentationPaused(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
