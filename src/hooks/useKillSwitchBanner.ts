/**
 * Hook para escutar erros do tipo KillSwitchActiveError emitidos pelo invoke.ts.
 * Permite que componentes mostrem aviso amigável quando o back-end legacy
 * está descontinuado, sem precisar try/catch em todo call site.
 *
 * Uso:
 *   const banner = useKillSwitchBanner();
 *   if (banner) return <KillSwitchBanner message={banner.message} />;
 */
import { useEffect, useState } from 'react';
import {
  getKillSwitchState,
  type KillSwitchActiveError,
} from '@/lib/external-db/kill-switch-client';

const SWITCH_NAME = 'edge_external_db_bridge';
const POLL_INTERVAL_MS = 120_000; // 2min — não-crítico, polling leve

export interface KillSwitchBannerData {
  switchName: string;
  message: string;
}

export function useKillSwitchBanner(): KillSwitchBannerData | null {
  const [banner, setBanner] = useState<KillSwitchBannerData | null>(null);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const state = await getKillSwitchState(SWITCH_NAME);
        if (cancelled) return;
        if (!state.enabled) {
          setBanner({
            switchName: SWITCH_NAME,
            message: state.message ?? 'Esta funcionalidade está temporariamente indisponível.',
          });
        } else {
          setBanner(null);
        }
      } catch {
        // ignore — fail-open
      }
    };

    check();
    const interval = setInterval(check, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return banner;
}

/**
 * Type-guard utilitário para identificar erros vindos do kill-switch.
 */
export function isKillSwitchError(err: unknown): err is KillSwitchActiveError {
  return err instanceof Error && err.name === 'KillSwitchActiveError';
}
