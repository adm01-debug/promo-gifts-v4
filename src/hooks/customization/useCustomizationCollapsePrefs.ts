/**
 * useCustomizationCollapsePrefs — Persistência cross-device do estado de
 * colapso do ConfigurationPanelV6.
 *
 * Estratégia em camadas:
 *  1. localStorage (instantâneo, mesmo deslogado)
 *  2. user_preferences.filter_states.__customization_collapse (sincroniza
 *     entre dispositivos quando autenticado). Reutilizamos a coluna JSONB
 *     existente sob um namespace dedicado para evitar mudanças de schema.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { createClientLogger } from '@/lib/telemetry/structuredLogger';

const LS_KEY = 'customization-collapsed:v1';
const LEGACY_PREFIX = 'customization-collapsed:'; // antigo: 1 chave por technique_id
const NS = '__customization_collapse';
const REMOTE_DEBOUNCE_MS = 800;
const log = createClientLogger('customization.collapsePrefs');

type Map = Record<string, boolean>;

/**
 * Migra chaves no formato antigo `customization-collapsed:<technique_id>` (valor
 * "1"/"0") para o novo mapa unificado `customization-collapsed:v1`. Idempotente
 * — após migrar, remove as chaves legadas. Exportada para uso em testes.
 */
export function migrateLegacyCollapseKeys(storage: Storage = window.localStorage): Map {
  let merged: Map = {};
  try {
    const rawNew = storage.getItem(LS_KEY);
    merged = rawNew ? (JSON.parse(rawNew) as Map) : {};
  } catch {
    merged = {};
  }
  const legacyKeys: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (!key || key === LS_KEY || !key.startsWith(LEGACY_PREFIX)) continue;
    const id = key.slice(LEGACY_PREFIX.length);
    if (!id) continue;
    const value = storage.getItem(key);
    // Não sobrescreve se o mapa novo já tem entrada para esta técnica.
    if (!(id in merged)) merged[id] = value === '1';
    legacyKeys.push(key);
  }
  if (legacyKeys.length > 0) {
    try {
      storage.setItem(LS_KEY, JSON.stringify(merged));
    } catch {
      /* ignore */
    }
    legacyKeys.forEach((k) => storage.removeItem(k));
  }
  return merged;
}

function readLocal(): Map {
  if (typeof window === 'undefined') return {};
  try {
    return migrateLegacyCollapseKeys(window.localStorage);
  } catch {
    return {};
  }
}

function writeLocal(map: Map): void {
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function useCustomizationCollapsePrefs(techniqueId: string | undefined) {
  const [map, setMap] = useState<Map>(() => readLocal());
  const mapRef = useRef(map);
  mapRef.current = map;

  // Debounce do upsert remoto: agrupa rajadas de toggle em uma única chamada.
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushRemote = useCallback(async () => {
    const snapshot = mapRef.current;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: existing } = await supabase
        .from('user_preferences')
        .select('filter_states')
        .eq('user_id', user.id)
        .maybeSingle();
      const filterStates = (existing?.filter_states as Record<string, unknown> | null) ?? {};
      const updated = { ...filterStates, [NS]: snapshot };
      const { error } = await supabase
        .from('user_preferences')
        .upsert({ user_id: user.id, filter_states: updated }, { onConflict: 'user_id' });
      if (error) log.warn('remote_sync_failed', { error: error.message });
    } catch (err) {
      log.warn('remote_sync_threw', { error: (err as Error).message });
    }
  }, []);

  // Hydrate from user_preferences (cross-device) quando autenticado.
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || !active) return;
        const { data } = await supabase
          .from('user_preferences')
          .select('filter_states')
          .eq('user_id', user.id)
          .maybeSingle();
        const remote = (data?.filter_states as Record<string, unknown> | null)?.[NS] as
          | Map
          | undefined;
        if (!active || !remote) return;
        const merged = { ...remote, ...mapRef.current }; // local wins em conflito recente
        setMap(merged);
        writeLocal(merged);
      } catch (err) {
        log.warn('hydrate_failed', { error: (err as Error).message });
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Flush pendente ao desmontar / antes de fechar a aba.
  useEffect(() => {
    const onUnload = () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
        void flushRemote();
      }
    };
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      onUnload();
    };
  }, [flushRemote]);

  const setCollapsed = useCallback(
    (id: string, value: boolean) => {
      const next = { ...mapRef.current, [id]: value };
      mapRef.current = next;
      setMap(next);
      writeLocal(next);

      // Analytics — emitido imediatamente em cada toggle (não sofre debounce).
      log.info(value ? 'panel_collapsed' : 'panel_expanded', {
        technique_id: id,
        state: value ? 'collapsed' : 'expanded',
      });

      // Debounce do upsert: 800ms após o último toggle.
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      syncTimerRef.current = setTimeout(() => {
        syncTimerRef.current = null;
        void flushRemote();
      }, REMOTE_DEBOUNCE_MS);
    },
    [flushRemote],
  );

  const collapsed = techniqueId ? !!map[techniqueId] : false;

  return { collapsed, setCollapsed };
}
