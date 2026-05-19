import { useMemo, useSyncExternalStore, useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { devInfraGate } from '@/lib/system/dev-gate/DevInfraGate';

/**
 * Hook customizado para encapsular a lógica de acesso ao Gate.
 * Reativo a mudanças de ambiente e configurações manuais (localStorage).
 * Garante que nada seja exibido até que o componente seja montado no cliente.
 */
export function useDevGate() {
  const { roles, isDev, isLoading } = useAuth();
  const [mounted, setMounted] = useState(false);
  const safeRoles = Array.isArray(roles) ? roles : [];

  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Otimização: Estabilizamos a referência das roles usando uma stringificação leve.
  // Isso evita que o hook dispare re-renders se o AuthContext retornar uma nova instância de array com os mesmos dados.
  const rolesKey = safeRoles.join(',');
  const stableRoles = useMemo(() => safeRoles, [rolesKey]);

  const isAllowedStore = useSyncExternalStore(
    (onStoreChange) => devInfraGate.subscribe(onStoreChange),
    () => devInfraGate.shouldShow(stableRoles),
    () => false
  );

  // Memoização do resultado final para evitar propagação de re-renders em componentes consumidores
  return useMemo(() => {
    const isAllowed = mounted && !isLoading && isAllowedStore;
    const isDevFinal = mounted && isDev;
    
    return {
      isAllowed,
      isDev: isDevFinal
    };
  }, [mounted, isLoading, isAllowedStore, isDev]);
}
