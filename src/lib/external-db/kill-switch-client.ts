/**
 * Kill-switch client — consulta o estado de switches em public.system_kill_switches
 * para que o FRONT-END pare de chamar edge functions descontinuadas ANTES
 * mesmo de fazer o invoke. Reduz tráfego à edge function, custo e logs ruidosos.
 *
 * Padrão (back-end espelho): docs/PATCH_external_db_bridge_kill_switch.md.
 * Tabela: public.system_kill_switches (criada na fase 1 do colapso 2026-05-24).
 *
 * Cache:
 *  - Memória: 60s (mesma janela do helper back-end _shared/kill_switch.ts).
 *  - localStorage: 5min, sobrevive reload e troca de aba. Backup em quota error.
 *
 * Falha aberta (fail-open): se a consulta falhar, ASSUME que o switch está
 * ON (= permite invoke). É segurança em camadas — o back-end ainda decide.
 */
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

const MEM_TTL_MS = 60_000;       // 60s — alinhado ao cache do helper back-end
const STORAGE_TTL_MS = 300_000;  // 5min — sobrevive reload/aba
const STORAGE_KEY_PREFIX = 'kill_switch:';

type SwitchCheck = {
  enabled: boolean;
  legacy_message?: string | null;
  fetchedAt: number;
};

type KillSwitchRow = {
  enabled?: boolean | null;
  legacy_message?: string | null;
};

type KillSwitchQueryResult = {
  data: KillSwitchRow | null;
  error: { message?: string } | null;
};

type KillSwitchTableClient = {
  from(table: 'system_kill_switches'): {
    select(columns: 'enabled, legacy_message'): {
      eq(column: 'switch_name', value: string): {
        maybeSingle(): Promise<KillSwitchQueryResult>;
      };
    };
  };
};

const memoryCache = new Map<string, SwitchCheck>();

function readFromLocalStorage(switchName: string): SwitchCheck | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_PREFIX + switchName);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SwitchCheck;
    if (Date.now() - parsed.fetchedAt > STORAGE_TTL_MS) {
      window.localStorage.removeItem(STORAGE_KEY_PREFIX + switchName);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeToLocalStorage(switchName: string, check: SwitchCheck): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY_PREFIX + switchName, JSON.stringify(check));
  } catch {
    // QuotaExceededError ou storage indisponível — ignorar (memória ainda funciona).
  }
}

export interface KillSwitchState {
  /** true = invoke OK; false = bloqueado, ver `message` para razão UX. */
  enabled: boolean;
  /** Mensagem amigável quando bloqueado (vem do banco). */
  message?: string | null;
  /** Origem do dado para diagnóstico. */
  source: 'memory' | 'storage' | 'network' | 'fail-open';
}

/**
 * Consulta o estado de um switch. NÃO lança — fail-open em qualquer erro.
 *
 * @example
 * const state = await getKillSwitchState('edge_external_db_bridge');
 * if (!state.enabled) {
 *   throw new Error(state.message ?? 'Service unavailable');
 * }
 */
export async function getKillSwitchState(switchName: string): Promise<KillSwitchState> {
  // 1) Memória (60s)
  const mem = memoryCache.get(switchName);
  if (mem && Date.now() - mem.fetchedAt < MEM_TTL_MS) {
    return { enabled: mem.enabled, message: mem.legacy_message, source: 'memory' };
  }

  // 2) localStorage (5min)
  const stored = readFromLocalStorage(switchName);
  if (stored) {
    memoryCache.set(switchName, stored);
    return { enabled: stored.enabled, message: stored.legacy_message, source: 'storage' };
  }

  // 3) Network (consulta REST nativa — tabela tem GRANT SELECT TO anon)
  try {
    // Cast controlado: a tabela `system_kill_switches` foi criada
    // após o último gen-types e ainda não está no Database type. Substituir
    // por `from('system_kill_switches')` tipado quando rodar `supabase gen types`.
    const client = supabase as unknown as KillSwitchTableClient;
    const { data, error } = await client
      .from('system_kill_switches')
      .select('enabled, legacy_message')
      .eq('switch_name', switchName)
      .maybeSingle();

    if (error) {
      logger.warn(`[kill-switch-client] consulta falhou para "${switchName}" — fail-open: ${error.message}`);
      return { enabled: true, source: 'fail-open' };
    }

    if (!data) {
      // Switch não cadastrado = assume ON (fail-open).
      return { enabled: true, source: 'fail-open' };
    }

    const check: SwitchCheck = {
      enabled: Boolean(data.enabled),
      legacy_message: data.legacy_message ?? null,
      fetchedAt: Date.now(),
    };
    memoryCache.set(switchName, check);
    writeToLocalStorage(switchName, check);

    return { enabled: check.enabled, message: check.legacy_message, source: 'network' };
  } catch (e) {
    logger.warn(`[kill-switch-client] erro inesperado para "${switchName}" — fail-open: ${(e as Error).message}`);
    return { enabled: true, source: 'fail-open' };
  }
}

/**
 * Força refresh do cache para um switch — útil quando o back-end retornar 410 Gone
 * (sinal de que o estado mudou).
 */
export function invalidateKillSwitchCache(switchName: string): void {
  memoryCache.delete(switchName);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(STORAGE_KEY_PREFIX + switchName);
    } catch {
      // ignore
    }
  }
}

/**
 * Erro lançado quando uma operação foi abortada pelo kill-switch (camada cliente).
 * Mensagem amigável vinda do banco em `state.message`.
 */
export class KillSwitchActiveError extends Error {
  switchName: string;
  message: string;
  constructor(switchName: string, message: string) {
    super(message);
    this.name = 'KillSwitchActiveError';
    this.switchName = switchName;
    this.message = message;
  }
}
