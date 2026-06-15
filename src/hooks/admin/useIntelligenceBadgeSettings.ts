/**
 * useIntelligenceBadgeSettings
 *
 * Configuração global das badges de Inteligência Comercial exibidas no
 * ProductCard (catálogo / super filtro). Persiste em `admin_settings`
 * sob a chave `intelligence_badges` para que todos os admins compartilhem
 * os mesmos thresholds sem precisar de deploy.
 *
 * - `hotItem.enabled`         → liga/desliga a badge 🔥 Hot Item
 * - `bestSeller.enabled`      → liga/desliga a badge 🏅 Best-seller
 * - `bestSeller.minAvgDailyDepletion7d` → limiar (média/dia 7d) que define best-seller
 *
 * Padrão usa cache module-level + broadcast, igual a useRetestCooldownSetting,
 * para que todos os cards montados reajam instantaneamente após salvar.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { sanitizeError } from '@/lib/security/sanitize-error';

const SETTING_KEY = 'intelligence_badges';

export interface IntelligenceBadgeSettings {
  hotItem: { enabled: boolean };
  bestSeller: { enabled: boolean; minAvgDailyDepletion7d: number };
}

export const DEFAULT_INTELLIGENCE_BADGE_SETTINGS: IntelligenceBadgeSettings = {
  hotItem: { enabled: true },
  bestSeller: { enabled: true, minAvgDailyDepletion7d: 15 },
};

function sanitize(raw: unknown): IntelligenceBadgeSettings {
  const base = DEFAULT_INTELLIGENCE_BADGE_SETTINGS;
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Record<string, unknown>;
  const hot = (r.hotItem ?? {}) as Record<string, unknown>;
  const best = (r.bestSeller ?? {}) as Record<string, unknown>;
  const minN = Number(best.minAvgDailyDepletion7d);
  return {
    hotItem: { enabled: hot.enabled !== false },
    bestSeller: {
      enabled: best.enabled !== false,
      minAvgDailyDepletion7d:
        Number.isFinite(minN) && minN > 0 ? minN : base.bestSeller.minAvgDailyDepletion7d,
    },
  };
}

let cached: IntelligenceBadgeSettings | null = null;
const listeners = new Set<(s: IntelligenceBadgeSettings) => void>();
function broadcast(s: IntelligenceBadgeSettings) {
  cached = s;
  for (const l of listeners) l(s);
}

interface Row {
  value: Json | null;
}

/**
 * Read-only snapshot (sem subscribe). Útil em hooks de cálculo. Faz fetch
 * preguiçoso uma única vez e mantém em cache.
 */
export function useIntelligenceBadgeSettingsValue(): IntelligenceBadgeSettings {
  const [settings, setSettings] = useState<IntelligenceBadgeSettings>(
    cached ?? DEFAULT_INTELLIGENCE_BADGE_SETTINGS,
  );

  useEffect(() => {
    const sub = (s: IntelligenceBadgeSettings) => setSettings(s);
    listeners.add(sub);
    if (cached === null) {
      // dispara fetch único — RLS permite admin; outros usuários caem no default
      void (async () => {
        const { data, error } = await supabase
          .from('admin_settings')
          .select('value')
          .eq('key', SETTING_KEY)
          .maybeSingle<Row>();
        if (error || !data) {
          broadcast(DEFAULT_INTELLIGENCE_BADGE_SETTINGS);
          return;
        }
        broadcast(sanitize(data.value));
      })();
    }
    return () => {
      listeners.delete(sub);
    };
  }, []);

  return settings;
}

export function useIntelligenceBadgeSettings() {
  const settings = useIntelligenceBadgeSettingsValue();
  const [saving, setSaving] = useState(false);

  const save = useCallback(async (next: IntelligenceBadgeSettings) => {
    setSaving(true);
    try {
      const clean = sanitize(next);
      const { error } = await supabase
        .from('admin_settings')
        .upsert({ key: SETTING_KEY, value: clean as unknown as Json }, { onConflict: 'key' });
      if (error) {
        toast.error('Não foi possível salvar as badges', { description: sanitizeError(error) });
        return false;
      }
      broadcast(clean);
      toast.success('Configuração das badges atualizada');
      return true;
    } finally {
      setSaving(false);
    }
  }, []);

  return { settings, saving, save };
}
