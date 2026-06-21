/**
 * Feature Flags — Controle de rollout de funcionalidades.
 *
 * Flags são definidas centralmente aqui. Para ativar/desativar,
 * basta alterar o valor default ou configurar via Supabase.
 *
 * Usage:
 *   import { isFeatureEnabled } from '@/lib/feature-flags';
 *   if (isFeatureEnabled('mfa')) { ... }
 */

export type FeatureFlag =
  | 'advanced_analytics'
  | 'ai_recommendations'
  /**
   * M-05: Controle dinâmico do crm-db-bridge (pgxfvjmuubtbowutlide).
   *
   * Alinhada com o pattern do kill-switch de external-db-bridge.
   * Quando false (via setFeatureFlag ou runtime override), o CRM bridge
   * pode operar em modo degradado (ex.: sem dados de empresas/contatos).
   *
   * Diferença do kill-switch real (system_kill_switches):
   * - Esta flag é client-side, gerenciada por código/deploy
   * - O kill-switch é server-side, gerenciado pelo banco de dados
   * Usar esta flag para feature rollout controlado; usar o kill-switch
   * para desligamentos de emergência (indisponibilidade, incidente).
   */
  | 'crm_bridge_enabled'
  | 'custom_kits_v2'
  | 'e2e_tests'
  | 'magic_up'
  | 'mfa'
  | 'presentation_mode'
  | 'useEmaRupture'
  | 'voice_commands';


interface FlagConfig {
  /** Default enabled state */
  enabled: boolean;
  /** Human description */
  description: string;
  /** Roles that can access (empty = all) */
  allowedRoles?: string[];
}

const FLAG_REGISTRY: Record<FeatureFlag, FlagConfig> = {
  mfa: {
    enabled: false,
    description: 'Autenticação multifator (TOTP)',
  },
  ai_recommendations: {
    enabled: true,
    description: 'Recomendações de produtos via IA',
  },
  presentation_mode: {
    enabled: true,
    description: 'Modo apresentação para orçamentos',
  },
  voice_commands: {
    enabled: true,
    description: 'Comandos de voz para busca e navegação',
  },
  magic_up: {
    enabled: true,
    description: 'Geração de mockups com IA',
  },
  e2e_tests: {
    enabled: false,
    description: 'Funcionalidades de testes E2E',
  },
  advanced_analytics: {
    enabled: true,
    description: 'Dashboard avançado de analytics',
    allowedRoles: ['admin', 'manager'],
  },
  custom_kits_v2: {
    enabled: false,
    description: 'Nova versão do montador de kits',
  },
  crm_bridge_enabled: {
    enabled: true,
    description:
      'CRM DB Bridge — acesso a empresas/contatos via crm-db-bridge ' +
      '(pgxfvjmuubtbowutlide). Desativar via setFeatureFlag para modo degradado ' +
      'sem CRM externo. Para desligamento de emergência, usar system_kill_switches.',
  },
};

// Runtime overrides (can be set via Supabase or localStorage in dev)
const runtimeOverrides = new Map<FeatureFlag, boolean>();

/**
 * Check if a feature flag is enabled.
 */
export function isFeatureEnabled(flag: FeatureFlag, userRole?: string): boolean {
  // Runtime override takes precedence
  if (runtimeOverrides.has(flag)) {
    return runtimeOverrides.get(flag) ?? false;
  }

  const config = FLAG_REGISTRY[flag];
  if (!config) return false;

  // Check role restriction
  if (config.allowedRoles && config.allowedRoles.length > 0 && userRole) {
    if (!config.allowedRoles.includes(userRole)) return false;
  }

  // Dev override via localStorage
  if (import.meta.env.DEV) {
    const stored = localStorage.getItem(`ff_${flag}`);
    if (stored !== null) return stored === 'true';
  }

  return config.enabled;
}

/**
 * Set a runtime override for a feature flag.
 */
export function setFeatureFlag(flag: FeatureFlag, enabled: boolean): void {
  runtimeOverrides.set(flag, enabled);
}

/**
 * Get all flags with their current state.
 */
export function getAllFlags(userRole?: string): Record<FeatureFlag, boolean> {
  const result = {} as Record<FeatureFlag, boolean>;
  for (const key of Object.keys(FLAG_REGISTRY) as FeatureFlag[]) {
    result[key] = isFeatureEnabled(key, userRole);
  }
  return result;
}

/**
 * Get flag metadata for admin UI.
 */
export function getFlagRegistry(): Record<FeatureFlag, FlagConfig> {
  return { ...FLAG_REGISTRY };
}
