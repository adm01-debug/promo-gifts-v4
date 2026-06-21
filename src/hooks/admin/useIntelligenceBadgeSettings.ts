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
 * Padrão usa cache module-level + broadcast + guard de requisição única,
 * igual a useRetestCooldownSetting, para que todos os cards montados reajam
 * instantaneamente após salvar — e para que dezenas de cards montando no mesmo
 * tick disparem apenas UM fetch (evita N+1 em admin_settings).
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
// Promise da única requisição em voo. Garante que, mesmo com dezenas de cards
// montando no mesmo tick (catálogo), só UM fetch ao admin_settings aconteça —
// os demais apenas aguardam o broadcast. (Corrige o N+1 de intelligence_badges.)
let inflight: Promise<void> | null = null;
const listeners = new Set<(s: IntelligenceBadgeSettings) => void>();
function broadcast(s: IntelligenceBadgeSettings) {
  cached = s;
  for (const l of listeners) l(s);
}

interface Row {
  value: Json | null;
}

/**
 * Dispara no máximo um fetch global (lazy) e popula o cache via broadcast.
 * Idempotente: se já há valor em cache ou uma requisição em voo, não faz nada.
 */
function ensureFetched(): void {
  if (cached !== null || inflight !== null) return;
  inflight = (async () => {
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('key', SETTING_KEY)
        .maybeSingle<Row>();
      // RLS permite admin; demais usuários (ou linha ausente) caem no default.
      broadcast(error || !data ? DEFAULT_INTELLIGENCE_BADGE_SETTINGS : sanitize(data.value));
    } catch {
      broadcast(DEFAULT_INTELLIGENCE_BADGE_SETTINGS);
    } finally {
      inflight = null;
    }
  })();
}

/**
 * Read-only snapshot (sem subscribe a mutações). Útil em hooks de cálculo.
 * Faz fetch preguiçoso uma única vez (compartilhado) e mantém em cache.
 */
export function useIntelligenceBadgeSettingsValue(): IntelligenceBadgeSettings {
  const [settings, setSettings] = useState<IntelligenceBadgeSettings>(
    cached ?? DEFAULT_INTELLIGENCE_BADGE_SETTINGS,
  );

  useEffect(() => {
    const sub = (s: IntelligenceBadgeSettings) => setSettings(s);
    listeners.add(sub);
    // Se o valor já chegou entre render e efeito (corrida), sincroniza do cache;
    // caso contrário, dispara o fetch único compartilhado.
    if (cached !== null) setSettings(cached);
    else ensureFetched();
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
