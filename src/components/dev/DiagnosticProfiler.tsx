import { Profiler, type ProfilerOnRenderCallback } from 'react';
import { logger } from '@/lib/logger';

interface DiagnosticEntry {
  id: string;
  phase: string;
  actualDuration: number;
  commitTime: number;
  timestamp: number;
}

declare global {
  interface Window {
    __DIAGNOSTICS__?: DiagnosticEntry[];
  }
}

/**
 * Diagnostic Profiler Wrapper
 *
 * Usage:
 * <DiagnosticProfiler id="MockupGenerator">
 *   <YourComponent />
 * </DiagnosticProfiler>
 */
export function DiagnosticProfiler({ id, children }: { id: string; children: React.ReactNode }) {
  const onRender: ProfilerOnRenderCallback = (
    _id,
    phase,
    actualDuration,
    baseDuration,
    startTime,
    commitTime,
  ) => {
    const ad = Number(actualDuration) || 0;
    const bd = Number(baseDuration) || 0;
    const st = Number(startTime) || 0;
    const ct = Number(commitTime) || 0;

    if (ad > 16 || import.meta.env.DEV) {
      logger.debug(`[Profiler:${id}] ${phase}`, {
        actualDuration: `${ad.toFixed(2)}ms`,
        baseDuration: `${bd.toFixed(2)}ms`,
        commitTime: ct.toFixed(2),
        startTime: st.toFixed(2),
      });
    }

    if (typeof window !== 'undefined' && window.__DIAGNOSTICS__) {
      window.__DIAGNOSTICS__.push({
        id,
        phase,
        actualDuration: ad,
        commitTime: ct,
        timestamp: Date.now(),
      });
    }
  };

  return (
    <Profiler id={id} onRender={onRender}>
      {children}
    </Profiler>
  );
}

// Inicializa o tracker global de diagnóstico se solicitado via URL ?diagnostics=true
if (typeof window !== 'undefined' && window.location.search.includes('diagnostics=true')) {
  window.__DIAGNOSTICS__ = [];
  console.info(
    '🛠️ Modo de Diagnóstico Ativado. Acesse window.__DIAGNOSTICS__ para ver os logs de renderização.',
  );
}
