import { devInfraGate } from './dev-gate/DevInfraGate';
import type { AppRole } from '@/contexts/AuthContext';

/**
 * @deprecated Use `devInfraGate.shouldShow(userRoles)` diretamente ou o hook `useDevGate()`.
 * Mantido para compatibilidade durante a migração. O parâmetro booleano legado
 * `isDev` é mapeado para o array de roles esperado pela política atual.
 */
export function shouldShowDevInfraMessages(isDev: boolean): boolean {
  const roles: AppRole[] = isDev ? ['dev'] : [];
  return devInfraGate.shouldShow(roles);
}
