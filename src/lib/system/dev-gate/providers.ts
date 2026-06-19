import type { GateValue, GateFlagProvider } from './types';

const TRUTHY = new Set(['true', '1', 'on', 'yes']);
const FALSY = new Set(['false', '0', 'off', 'no']);

/**
 * Utilitário para parsear strings em valores do Gate.
 */
export function parseGateFlag(raw: unknown): GateValue {
  if (typeof raw !== 'string') return 'auto';
  const v = raw.trim().toLowerCase();
  if (v === '' || v === 'auto') return 'auto';
  if (TRUTHY.has(v)) return true;
  if (FALSY.has(v)) return false;
  return 'auto';
}

/**
 * Provedor de flag baseado em variáveis de ambiente do Vite.
 */
export class EnvGateProvider implements GateFlagProvider {
  private static cachedValue: GateValue | null = null;

  getFlag(): GateValue {
    if (EnvGateProvider.cachedValue !== null) return EnvGateProvider.cachedValue;

    try {
      // Otimização: Acesso direto ao import.meta.env (Vite substitui em build-time)
      // O cache estático evita parsing de string em cada chamada.
      const raw = import.meta.env.VITE_SHOW_DEV_INFRA_MESSAGES;
      EnvGateProvider.cachedValue = parseGateFlag(raw);
      return EnvGateProvider.cachedValue;
    } catch {
      return 'auto';
    }
  }
}

/**
 * Provedor de flag baseado em localStorage.
 */
export class LocalStorageGateProvider implements GateFlagProvider {
  private readonly key: string;
  private lastValue: GateValue | null = null;
  private lastRaw: string | null = null;

  constructor(key = 'show_dev_infra_messages') {
    this.key = key;
  }

  getFlag(): GateValue {
    if (typeof window === 'undefined' || !window.localStorage) return 'auto';

    try {
      const raw = window.localStorage.getItem(this.key);
      // Otimização: Evitar parsing se o valor bruto no localStorage não mudou
      if (raw === this.lastRaw && this.lastValue !== null) {
        return this.lastValue;
      }

      this.lastRaw = raw;
      this.lastValue = parseGateFlag(raw);
      return this.lastValue;
    } catch {
      return 'auto';
    }
  }
}
