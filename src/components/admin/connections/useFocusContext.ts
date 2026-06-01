/**
 * useFocusContext — Onda 14
 *
 * Persiste o último contexto de navegação do hub `/admin/conexoes`:
 *   - lastZone   : id da zona em foco (clicada via Quick Nav, palette ou incidente)
 *   - lastIncidentId : id do incidente cujo drawer foi aberto por último
 *   - savedAt    : timestamp do último save (para expirar contexto antigo)
 *
 * Ao recarregar, a página consulta este contexto e:
 *   1. Restaura visibility/expand da zona alvo;
 *   2. Faz scroll até a âncora;
 *   3. Reabre o drawer do último incidente, se ainda existir nos dados atuais.
 *
 * TTL de 30 minutos: contexto mais antigo é descartado para evitar
 * "fantasmas" depois que o usuário sai e volta horas depois.
 */
import { useCallback, useEffect, useState } from 'react';
import type { ZoneId } from './useZoneVisibility';

const STORAGE_KEY = 'connections.focus-context.v1';
const TTL_MS = 30 * 60 * 1000; // 30 minutos

export interface FocusContext {
  lastZone: ZoneId | null;
  lastIncidentId: string | null;
  savedAt: number;
}

const EMPTY: FocusContext = {
  lastZone: null,
  lastIncidentId: null,
  savedAt: 0,
};

function loadInitial(): FocusContext {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<FocusContext>;
    const savedAt = typeof parsed.savedAt === 'number' ? parsed.savedAt : 0;
    // Expira contexto antigo
    if (savedAt && Date.now() - savedAt > TTL_MS) return { ...EMPTY };
    return {
      lastZone: (parsed.lastZone as ZoneId | null) ?? null,
      lastIncidentId: parsed.lastIncidentId ?? null,
      savedAt,
    };
  } catch {
    return { ...EMPTY };
  }
}

export function useFocusContext() {
  const [context, setContext] = useState<FocusContext>(loadInitial);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(context));
    } catch {
      /* noop */
    }
  }, [context]);

  const setZone = useCallback((zone: ZoneId | null) => {
    setContext((prev) => ({ ...prev, lastZone: zone, savedAt: Date.now() }));
  }, []);

  const setIncident = useCallback((id: string | null) => {
    setContext((prev) => ({ ...prev, lastIncidentId: id, savedAt: Date.now() }));
  }, []);

  const clear = useCallback(() => setContext({ ...EMPTY }), []);

  return { context, setZone, setIncident, clear };
}

/** Apenas leitura inicial (sem reagir). Útil para restauração one-shot no mount. */
export function readFocusContextOnce(): FocusContext {
  return loadInitial();
}

export const __TEST__ = { STORAGE_KEY, TTL_MS };
