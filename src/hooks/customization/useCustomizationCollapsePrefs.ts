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
const NS = '__customization_collapse';
const log = createClientLogger('customization.collapsePrefs');

type Map = Record<string, boolean>;

function readLocal(): Map {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as Map) : {};
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

  const setCollapsed = useCallback(
    async (id: string, value: boolean) => {
      const next = { ...mapRef.current, [id]: value };
      mapRef.current = next;
      setMap(next);
      writeLocal(next);

      // Analytics — emite evento estruturado independente do backend.
      log.info(value ? 'panel_collapsed' : 'panel_expanded', {
        technique_id: id,
        state: value ? 'collapsed' : 'expanded',
      });

      // Sync remoto (best-effort).
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
        const updated = { ...filterStates, [NS]: next };
        const { error } = await supabase
          .from('user_preferences')
          .upsert(
            { user_id: user.id, filter_states: updated },
            { onConflict: 'user_id' },
          );
        if (error) log.warn('remote_sync_failed', { error: error.message });
      } catch (err) {
        log.warn('remote_sync_threw', { error: (err as Error).message });
      }
    },
    [],
  );

  const collapsed = techniqueId ? !!map[techniqueId] : false;

  return { collapsed, setCollapsed };
}
