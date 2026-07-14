import { useState, useCallback, useRef, useEffect } from 'react';
import { getSupabaseClient } from '@/integrations/supabase/lazy-client';
import { type AppRole, type Profile } from '@/contexts/AuthContext';
import { createClientLogger } from '@/lib/telemetry/structuredLogger';
import type { PostgrestError } from '@supabase/supabase-js';

// AUTH-HYDRATION-FIX v2 (2026-07-14):
//  1. Timeout elevado 5s → 7s (watchdog dispara em 8s, mantendo 1s de margem)
//  2. Retry delay reduzido 800ms → 500ms para recuperação mais rápida
//  3. RPC get_profile_and_roles: 1 round-trip em vez de 2 (profiles + user_roles)
//  4. hydration_timeout rebaixado de log.error → log.warn (condição esperada)
//  5. Promise órfã eliminada: verificação antes de criar a Promise de dedup
//  6. getSupabaseClient() chamado ANTES do withTimeout (fora do budget do timer)
const HYDRATION_TIMEOUT_MS = 7_000;
const HYDRATION_MAX_RETRIES = 2;
const HYDRATION_RETRY_DELAY_MS = 500;

/**
 * Resolve com a Promise original, ou rejeita após `ms` ms.
 * Limpa o timer ao assentar para não vazar.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`hydration_timeout:${label}:${ms}ms`));
    }, ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err)   => { clearTimeout(timer); reject(err); },
    );
  });
}

// Forma do JSON retornado pela RPC pública get_profile_and_roles
interface RPCProfileAndRoles {
  profile: Profile | null;
  roles: string[] | null;
}

export function useProfileRoles() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userRoles, setUserRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [rolesLoaded, setRolesLoaded] = useState(false);

  // fetchPromiseRef: Promise de dedup — nula quando nenhuma busca está em andamento.
  const fetchPromiseRef = useRef<Promise<void> | null>(null);
  // fetchGenerationRef: contador de geração — invalida resultados de buscas antigas
  // que ficaram em voo após signOut ou novo login concorrente.
  const fetchGenerationRef = useRef(0);
  // retryTimerRef / fetchAttemptsRef: gerenciam retries em background após timeout.
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchAttemptsRef = useRef(0);
  // fetchUserDataRef: ref estável para auto-invocação do retry sem ciclo de dep.
  const fetchUserDataRef = useRef<((userId: string) => Promise<void>) | null>(null);

  const fetchUserData = useCallback(async (userId: string) => {
    // BUG-FIX v2: verifica ANTES de criar a Promise para evitar Promise órfã.
    // Na versão anterior, a Promise era criada antes do check; quando o caminho
    // de dedup era tomado (return), resolvePromise() nunca era chamado e a
    // Promise ficava pendente indefinidamente (memory leak sutil).
    if (fetchPromiseRef.current) {
      await fetchPromiseRef.current;
      return;
    }

    // Cria a Promise de dedup SINCRONAMENTE antes de qualquer await.
    // Isso garante que chamadas concorrentes que chegarem enquanto doFetch() roda
    // encontrarão fetchPromiseRef.current !== null e tomarão o caminho de dedup.
    let resolveDedup!: () => void;
    const dedupPromise = new Promise<void>((resolve) => { resolveDedup = resolve; });
    fetchPromiseRef.current = dedupPromise;
    const myGeneration = ++fetchGenerationRef.current;

    const log = createClientLogger('useProfileRoles.fetchUserData');

    const doFetch = async () => {
      log.info('start', { userId });
      let succeeded = false;
      try {
        // BUG-FIX v2: inicializa o cliente ANTES do withTimeout para que a
        // inicialização lazy do singleton não consuma o budget do timer.
        // authService.queryRoles() chamava getSupabaseClient() DENTRO do timer,
        // podendo desperdiçar até ~200ms do budget em cold starts.
        const supabase = await getSupabaseClient();

        // FIX PRINCIPAL: RPC get_profile_and_roles combina o SELECT em profiles
        // e o SELECT em user_roles em um único round-trip ao Supabase.
        // Antes: Promise.all([profileFetch, rolesFetch]) = 2 round-trips paralelos
        //        (cada um sujeito a latência de rede e overhead de RLS separado).
        // Agora: 1 RPC = ~50% menos latência + execução inteiramente server-side.
        const { data, error } = await withTimeout(
          // Usamos cast porque os tipos gerados podem ainda não incluir a nova
          // função; a migration já foi aplicada no Supabase.
          (supabase.rpc as (
            fn: string,
            args: Record<string, unknown>,
          ) => Promise<{ data: RPCProfileAndRoles | null; error: PostgrestError | null }>)(
            'get_profile_and_roles',
            { _user_id: userId },
          ),
          HYDRATION_TIMEOUT_MS,
          'profile+roles',
        );

        // Guard de geração: descarta resultado de busca supersedida
        // (signOut → clearProfileRoles, ou novo login concorrente).
        if (fetchGenerationRef.current !== myGeneration) return;

        if (error) {
          log.error('rpc_error', { error });
          if (error.code === '42501') {
            const { toast } = await import('sonner');
            toast.error('Erro de permissão ao carregar perfil', {
              description: 'Não foi possível ler seus dados. Contate o suporte.',
            });
          }
          // Não seta succeeded → retry será agendado no finally
        } else {
          setProfile(data?.profile ?? null);
          setUserRoles((data?.roles ?? []) as AppRole[]);
          log.info('done', { userId, roleCount: data?.roles?.length ?? 0 });
          succeeded = true;
          fetchAttemptsRef.current = 0;
        }
      } catch (error) {
        // BUG-FIX v2: hydration_timeout é condição ESPERADA (rede lenta / cold
        // start do Supabase), não um erro crítico. Rebaixa log.error → log.warn
        // para não poluir o dashboard de erros com falsos positivos.
        // Erros inesperados (não-timeout) continuam sendo logados como error.
        const isTimeout =
          error instanceof Error &&
          error.message.startsWith('hydration_timeout:');
        if (isTimeout) {
          log.warn('hydration_timeout', { userId, error });
        } else {
          log.error('exception', { userId, error });
        }
      } finally {
        // A geração atual é a única que pode modificar o estado compartilhado.
        // Buscas supersedidas não devem zerar o handle nem flipar flags de loading.
        if (fetchGenerationRef.current === myGeneration) {
          fetchPromiseRef.current = null;
          setIsLoading(false);
          setRolesLoaded(true);

          // Agenda retry em background se a busca falhou (timeout / rede) e
          // ainda há tentativas disponíveis. A UI já foi liberada acima;
          // o retry repopula perfil/roles silenciosamente quando a rede voltar.
          if (!succeeded && fetchAttemptsRef.current < HYDRATION_MAX_RETRIES) {
            fetchAttemptsRef.current += 1;
            if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
            retryTimerRef.current = setTimeout(() => {
              retryTimerRef.current = null;
              if (fetchGenerationRef.current === myGeneration) {
                void fetchUserDataRef.current?.(userId);
              }
            }, HYDRATION_RETRY_DELAY_MS);
          }
        }
        // Sempre resolve a Promise de dedup (mesmo em buscas supersedidas)
        // para desbloquear quem estiver aguardando no caminho de dedup.
        resolveDedup();
      }
    };

    void doFetch();
    // Aguarda a Promise local (não fetchPromiseRef.current, que pode ser
    // nulificada antes da resolução no finally do doFetch).
    await dedupPromise;
  }, []);

  const clearProfileRoles = useCallback(() => {
    // Invalida qualquer busca em voo e libera o handle de dedup para que um
    // login posterior inicie uma busca fresca em vez de piggyback na abortada.
    fetchGenerationRef.current++;
    fetchPromiseRef.current = null;
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    fetchAttemptsRef.current = 0;
    setProfile(null);
    setUserRoles([]);
    setIsLoading(false);
    setRolesLoaded(false);
  }, []);

  // Mantém ref estável apontando para a fetchUserData mais recente
  // para que o retry agendado possa se reinvocar sem ciclo de dependência.
  useEffect(() => {
    fetchUserDataRef.current = fetchUserData;
  }, [fetchUserData]);

  // Limpeza no unmount: cancela qualquer retry de hidratação pendente.
  useEffect(() => {
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, []);

  return {
    profile,
    setProfile,
    userRoles,
    setUserRoles,
    isLoading,
    setIsLoading,
    rolesLoaded,
    setRolesLoaded,
    fetchUserData,
    clearProfileRoles,
    fetchPromiseRef,
  };
}
