/**
 * useOfflineGuard — hook para proteger operações de escrita quando offline.
 *
 * Uso:
 *   const { isOffline, guardedMutate } = useOfflineGuard();
 *
 *   // Em vez de chamar mutate() diretamente:
 *   guardedMutate(() => mutate(payload));
 *
 * Também expõe `isOffline` para desabilitar botões de submit:
 *   <Button disabled={isOffline || isLoading}>Salvar</Button>
 */
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

export function useOfflineGuard() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const isOffline = !isOnline;

  /**
   * Executa `fn` somente se online.
   * Se offline, exibe toast explicativo e retorna false.
   */
  const guardedMutate = useCallback(
    <T>(fn: () => Promise<T> | T): Promise<T> | T | false => {
      if (isOffline) {
        toast.error('Sem conexão com a internet', {
          description: 'Verifique sua conexão Wi-Fi ou dados móveis e tente novamente.',
          duration: 5000,
        });
        return false;
      }
      return fn();
    },
    [isOffline],
  );

  return { isOnline, isOffline, guardedMutate };
}
