/**
 * Kill-switch client — consulta o estado de switches em public.system_kill_switches
 * com suporte a ROLLOUT GRADUAL (A/B canary) via fn_should_apply_kill_switch.
 *
 * Padrão (back-end espelho): docs/PATCH_external_db_bridge_kill_switch.md
 * Plano A/B: docs/PLANO_AB_DESLIGAMENTO_SWITCH.md
 *
 * Cache:
 *  - Memória: 60s
 *  - localStorage: 5min, sobrevive reload e troca de aba
 *
 * Falha aberta (fail-open): se a consulta falhar, ASSUME que o switch está
 * ON (= permite invoke). É segurança em camadas — o back-end ainda decide.
 *
 * Rollout gradual: quando `rollout_percentage < 100`, apenas X% dos clientes
 * (determinístico por bucket_key = user_id || anon_bucket) recebem o kill.
 */
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

const MEM_TTL_MS = 60_000;
const STORAGE_TTL_MS = 300_000;
const STORAGE_KEY_PREFIX = 'kill_switch:';
const BUCKET_KEY_STORAGE = 'kill_switch:bucket_key';

type SwitchCheck = {
  enabled: boolean;
  legacy_message?: string | null;
  fetchedAt: number;
  /** Resultado do rollout para o bucket_key deste cliente. */
  shouldApply?: boolean;
};

type KillSwitchRow = {
  enabled?: boolean | null;
  legacy_message?: string | null;
};

type KillSwitchQueryResult = {
  data: KillSwitchRow | null;
  error: { message?: string } | null;
};

type KillSwitchRpcResult = {
  data: boolean | null;
  error: { message?: string } | null;
};

type KillSwitchTableClient = {
  from(table: 'system_kill_switches'): {
    select(columns: 'enabled, legacy_message'): {
      eq(
        column: 'switch_name',
        value: string,
      ): {
        maybeSingle(): Promise<KillSwitchQueryResult>;
      };
    };
  };
  rpc(
    fn: 'fn_should_apply_kill_switch',
    args: { p_switch_name: string; p_bucket_key: string },
  ): Promise<KillSwitchRpcResult>;
};

const memoryCache = new Map<string, SwitchCheck>();

/**
 * Bucket key estável por cliente. Para usuários anon, gera UUID v4 leve
 * uma única vez e persiste em localStorage. Para logged-in (futuro),
 * pode-se usar auth.uid().
 */
function getBucketKey(): string {
  if (typeof window === 'undefined' || !window.localStorage) {
    return 'ssr-anon';
  }
  try {
    let key = window.localStorage.getItem(BUCKET_KEY_STORAGE);
    if (!key) {
      // UUID-like leve sem depender de crypto.randomUUID (compatível com browsers antigos)
      key =
        Date.now().toString(36) +
        Math.random().toString(36).slice(2, 10) +
        Math.random().toString(36).slice(2, 10);
      window.localStorage.setItem(BUCKET_KEY_STORAGE, key);
    }
    return key;
  } catch {
    return 'fallback-anon';
  }
}

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
  /** true = invoke OK; false = bloqueado. Considera o rollout %. */
  enabled: boolean;
  /** Mensagem amigável quando bloqueado (vem do banco). */
  message?: string | null;
  /** Origem do dado para diagnóstico. */
  source: 'memory' | 'storage' | 'network' | 'fail-open';
}

/**
 * Consulta o estado efetivo de um switch para este cliente (considerando rollout).
 * Fail-open em qualquer erro.
 *
 * Algoritmo:
 *   1. Lê {enabled, legacy_message} de system_kill_switches (com cache 60s+5min)
 *   2. Se enabled=true → retorna {enabled: true} imediatamente (caso comum, switch ATIVO)
 *   3. Se enabled=false → chama RPC fn_should_apply_kill_switch para decidir
 *      considerando o rollout_percentage e o bucket_key deste cliente
 *   4. Cacheia o resultado para evitar RPCs repetidos
 */
export async function getKillSwitchState(switchName: string): Promise<KillSwitchState> {
  // 1) Memória
  const mem = memoryCache.get(switchName);
  if (mem && Date.now() - mem.fetchedAt < MEM_TTL_MS) {
    return resolveEffectiveState(mem, 'memory');
  }

  // 2) localStorage
  const stored = readFromLocalStorage(switchName);
  if (stored) {
    memoryCache.set(switchName, stored);
    return resolveEffectiveState(stored, 'storage');
  }

  // 3) Network
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
      logger.warn(
        `[kill-switch-client] consulta falhou para "${switchName}" — fail-open: ${error.message}`,
      );
      return { enabled: true, source: 'fail-open' };
    }

    if (!data) {
      return { enabled: true, source: 'fail-open' };
    }

    const enabled = Boolean(data.enabled);
    let shouldApply: boolean | undefined;

    // Se switch está OFF (enabled=false), consulta rollout para este cliente
    if (!enabled) {
      try {
        const bucketKey = getBucketKey();
        const { data: rpcResult, error: rpcError } = await client.rpc(
          'fn_should_apply_kill_switch',
          { p_switch_name: switchName, p_bucket_key: bucketKey },
        );
        if (rpcError) {
          // RPC falhou — default conservador: aplica kill (mesmo comportamento de quando rollout=100)
          logger.warn(`[kill-switch-client] RPC rollout falhou — assume 100%: ${rpcError.message}`);
          shouldApply = true;
        } else {
          shouldApply = Boolean(rpcResult);
        }
      } catch (e) {
        logger.warn(`[kill-switch-client] RPC rollout erro — assume 100%: ${(e as Error).message}`);
        shouldApply = true;
      }
    }

    const check: SwitchCheck = {
      enabled,
      legacy_message: data.legacy_message ?? null,
      shouldApply,
      fetchedAt: Date.now(),
    };
    memoryCache.set(switchName, check);
    writeToLocalStorage(switchName, check);

    return resolveEffectiveState(check, 'network');
  } catch (e) {
    logger.warn(
      `[kill-switch-client] erro inesperado para "${switchName}" — fail-open: ${(e as Error).message}`,
    );
    return { enabled: true, source: 'fail-open' };
  }
}

/**
 * Combina enabled (banco) + shouldApply (rollout) para um estado efetivo.
 *
 * Tabela verdade:
 *   enabled=true                       → effective enabled=true (sempre permite)
 *   enabled=false, shouldApply=undef   → effective enabled=false (sem rollout, modo legado)
 *   enabled=false, shouldApply=true    → effective enabled=false (no bucket de teste, bloqueado)
 *   enabled=false, shouldApply=false   → effective enabled=true (fora do rollout, permite)
 */
function resolveEffectiveState(
  check: SwitchCheck,
  source: KillSwitchState['source'],
): KillSwitchState {
  // Switch ATIVO — sempre permite
  if (check.enabled) {
    return { enabled: true, source };
  }
  // Switch OFF — considera rollout
  // Se shouldApply não foi calculado (cache antigo pré-rollout), assume 100% (= aplica)
  const blockedByRollout = check.shouldApply ?? true;
  if (!blockedByRollout) {
    // Fora do rollout — cliente não está no bucket de teste, mantém comportamento antigo
    return { enabled: true, source };
  }
  // Dentro do bucket — bloqueia
  return {
    enabled: false,
    message: check.legacy_message,
    source,
  };
}

/**
 * Força refresh do cache para um switch.
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
 * Erro lançado quando uma operação foi abortada pelo kill-switch.
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
