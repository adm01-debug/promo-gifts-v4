import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { sanitizeError } from '@/lib/security/sanitize-error';

/**
 * Global admin-controlled cooldown (ms) for the "Testar novamente" button on
 * connection cards. Persisted in `admin_settings` under the `retest_cooldown`
 * key so all admins share the same value across machines.
 *
 * Only admins can read/write this row (RLS); non-admins fall back to default.
 */
const SETTING_KEY = 'retest_cooldown';
const DEFAULT_MS = 3000;
export const RETEST_COOLDOWN_PRESETS_MS = [3000, 10_000, 30_000, 60_000] as const;
export type RetestCooldownPreset = (typeof RETEST_COOLDOWN_PRESETS_MS)[number];

interface SettingRow {
  value: { ms?: number } | null;
}

// Module-level cache so all <RetestButton> instances share a single fetch and
// stay in sync after a save without round-tripping to the DB.
let cached: number | null = null;
// Promise da única requisição em voo: vários botões montando juntos disparam
// apenas UM fetch ao admin_settings (evita N+1); os demais aguardam o broadcast.
let inflight: Promise<void> | null = null;
const listeners = new Set<(ms: number) => void>();

function broadcast(ms: number): void {
  cached = ms;
  for (const l of listeners) l(ms);
}

/** Lazy single-flight fetch do cooldown global. Idempotente. */
function ensureFetched(): void {
  if (cached !== null || inflight !== null) return;
  inflight = (async () => {
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('key', SETTING_KEY)
        .maybeSingle<SettingRow>();
      if (error || !data) {
        broadcast(DEFAULT_MS);
        return;
      }
      const ms = Number(data.value?.ms);
      broadcast(Number.isFinite(ms) && ms > 0 ? ms : DEFAULT_MS);
    } catch {
      broadcast(DEFAULT_MS);
    } finally {
      inflight = null;
    }
  })();
}

export function useRetestCooldownSetting() {
  const [cooldownMs, setCooldownMs] = useState<number>(cached ?? DEFAULT_MS);
  const [loading, setLoading] = useState<boolean>(cached === null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Atualiza valor e encerra o loading assim que o broadcast (fetch único
    // compartilhado) chegar — inclusive para instâncias que não dispararam o fetch.
    const sub = (ms: number) => {
      setCooldownMs(ms);
      setLoading(false);
    };
    listeners.add(sub);
    if (cached !== null) {
      // valor já disponível (inclui corrida entre render e efeito)
      setCooldownMs(cached);
      setLoading(false);
    } else {
      ensureFetched();
    }
    return () => {
      listeners.delete(sub);
    };
  }, []);

  const save = useCallback(async (ms: number) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('admin_settings')
        .upsert({ key: SETTING_KEY, value: { ms } }, { onConflict: 'key' });
      if (error) {
        toast.error('Não foi possível salvar o cooldown', { description: sanitizeError(error) });
        return false;
      }
      broadcast(ms);
      toast.success('Cooldown atualizado', {
        description: `Novos testes manuais aguardarão ${Math.round(ms / 1000)}s entre disparos.`,
      });
      return true;
    } finally {
      setSaving(false);
    }
  }, []);

  return { cooldownMs, loading, saving, save };
}
