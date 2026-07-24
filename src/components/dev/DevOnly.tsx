/**
 * DevOnly — Guard reutilizável para overlays e banners de infra.
 *
 * Renderiza `children` apenas quando o usuário passa pelo `useDevGate`
 * (role `dev` ou override via env/localStorage — ver Dev Infra Messages Gate).
 *
 * Uso:
 *   <DevOnly>
 *     <BridgeMetricsOverlay />
 *   </DevOnly>
 *
 * Modo estrito (apenas `isDev`, ignora overrides de env/localStorage):
 *   <DevOnly strict>
 *     <SomeRoleOnlyWidget />
 *   </DevOnly>
 *
 * Fallback opcional quando bloqueado:
 *   <DevOnly fallback={<PublicBanner />}>
 *     <InternalBanner />
 *   </DevOnly>
 */
import { memo, type ReactNode } from 'react';
import { useDevGate } from '@/hooks/admin/useDevGate';

export interface DevOnlyProps {
  children: ReactNode;
  /** Mostra esse conteúdo quando o gate bloqueia. Default: `null`. */
  fallback?: ReactNode;
  /**
   * Quando `true`, exige role `dev` real (ignora override por env/localStorage).
   * Default: `false` — segue o gate padrão (`isAllowed`).
   */
  strict?: boolean;
}

export const DevOnly = memo(({ children, fallback = null, strict = false }: DevOnlyProps) => {
  const { isAllowed, isDev } = useDevGate();
  const allowed = strict ? isDev : isAllowed;
  return <>{allowed ? children : fallback}</>;
});
