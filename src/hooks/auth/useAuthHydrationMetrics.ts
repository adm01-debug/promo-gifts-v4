/**
 * useAuthHydrationMetrics.ts
 * Hook de observabilidade para a hidratação de auth (profile+roles).
 *
 * Mede e expõe:
 *  - Latência real de cada fetch (ms)
 *  - Taxa de hydration_timeout por sessão
 *  - Número de retries realizados
 *  - Indicador de "hidratação lenta" (p95 > 2000ms)
 *
 * USO: importar no useProfileRoles e chamar recordHydration(durationMs, succeeded)
 * após cada fetch. Dados ficam em memória — sem I/O, sem overhead.
 *
 * Criado em 2026-07-14 como parte do fix BUG-AUTH-HYDRATION-v2 (OBS gaps).
 */

import { useRef, useCallback } from 'react';

// Limite para considerar hidratação "lenta"
const SLOW_HYDRATION_THRESHOLD_MS = 2_000;
// Janela de amostras mantidas em memória (últimas N por sessão)
const MAX_SAMPLES = 20;

export interface HydrationSample {
  durationMs: number;
  succeeded: boolean;
  retriedAt?: number; // timestamp se foi retry (não fetch inicial)
  ts: number;         // Date.now() no momento da medição
}

export interface HydrationMetrics {
  /** Total de fetchs realizados (inclui retries) */
  totalFetches: number;
  /** Total de fetches que resultaram em timeout ou erro */
  totalFailures: number;
  /** Total de retries agendados */
  totalRetries: number;
  /** % de fetchs com falha (0-100) */
  failureRate: number;
  /** Latência mínima registrada (ms) — 0 se sem amostras */
  minMs: number;
  /** Latência máxima registrada (ms) */
  maxMs: number;
  /** Latência média (ms) — dos fetches com sucesso */
  avgSuccessMs: number;
  /** p95 estimado das latências de sucesso */
  p95Ms: number;
  /** true quando p95 > SLOW_HYDRATION_THRESHOLD_MS */
  isSlowHydration: boolean;
  /** Últimas N amostras para debugging */
  samples: HydrationSample[];
}

export interface UseAuthHydrationMetricsResult {
  /** Registra resultado de um fetch (chamar no finally do doFetch) */
  recordHydration: (durationMs: number, succeeded: boolean, isRetry?: boolean) => void;
  /** Métricas calculadas em tempo real */
  getMetrics: () => HydrationMetrics;
  /** Reseta todas as métricas (ex: após signOut) */
  resetMetrics: () => void;
}

export function useAuthHydrationMetrics(): UseAuthHydrationMetricsResult {
  const samplesRef = useRef<HydrationSample[]>([]);
  const totalFetchesRef = useRef(0);
  const totalFailuresRef = useRef(0);
  const totalRetriesRef = useRef(0);

  const recordHydration = useCallback(
    (durationMs: number, succeeded: boolean, isRetry = false) => {
      totalFetchesRef.current++;
      if (!succeeded) totalFailuresRef.current++;
      if (isRetry) totalRetriesRef.current++;

      const sample: HydrationSample = {
        durationMs,
        succeeded,
        ts: Date.now(),
        ...(isRetry ? { retriedAt: Date.now() } : {}),
      };

      // Mantém janela deslizante de MAX_SAMPLES
      samplesRef.current = [...samplesRef.current.slice(-MAX_SAMPLES + 1), sample];
    },
    [],
  );

  const getMetrics = useCallback((): HydrationMetrics => {
    const samples = samplesRef.current;
    const total = totalFetchesRef.current;
    const failures = totalFailuresRef.current;
    const retries = totalRetriesRef.current;

    if (samples.length === 0) {
      return {
        totalFetches: total,
        totalFailures: failures,
        totalRetries: retries,
        failureRate: 0,
        minMs: 0,
        maxMs: 0,
        avgSuccessMs: 0,
        p95Ms: 0,
        isSlowHydration: false,
        samples: [],
      };
    }

    // Só usa fetches bem-sucedidos para latência (evita skew de timeouts)
    const successSamples = samples.filter((s) => s.succeeded).map((s) => s.durationMs);
    const sorted = [...successSamples].sort((a, b) => a - b);

    const minMs = sorted[0] ?? 0;
    const maxMs = sorted[sorted.length - 1] ?? 0;
    const avgSuccessMs =
      sorted.length > 0
        ? Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length)
        : 0;

    // p95: índice no percentil 95 das amostras ordenadas
    const p95Index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
    const p95Ms = sorted[p95Index] ?? 0;

    const failureRate = total > 0 ? Math.round((failures / total) * 100) : 0;

    return {
      totalFetches: total,
      totalFailures: failures,
      totalRetries: retries,
      failureRate,
      minMs,
      maxMs,
      avgSuccessMs,
      p95Ms,
      isSlowHydration: p95Ms > SLOW_HYDRATION_THRESHOLD_MS,
      samples,
    };
  }, []);

  const resetMetrics = useCallback(() => {
    samplesRef.current = [];
    totalFetchesRef.current = 0;
    totalFailuresRef.current = 0;
    totalRetriesRef.current = 0;
  }, []);

  return { recordHydration, getMetrics, resetMetrics };
}
