import { useState, useCallback, useRef, useEffect } from 'react';
import { getSupabaseClient } from '@/integrations/supabase/lazy-client';
import { type AppRole, type Profile } from '@/contexts/AuthContext';
import { createClientLogger } from '@/lib/telemetry/structuredLogger';
import type { PostgrestError } from '@supabase/supabase-js';

// AUTH-HYDRATION-FIX v2.1 (2026-07-14):
//  [v2]   1. Timeout 5s → 7s (watchdog em 8s, mantendo 1s de margem)
//  [v2]   2. Retry delay 800ms → 500ms
//  [v2]   3. RPC get_profile_and_roles: 1 round-trip vs 2 paralelos
//  [v2]   4. hydration_timeout: log.error → log.warn (condição esperada)
//  [v2]   5. Promise órfã eliminada: verifica antes de criar Promise de dedup
//  [v2]   6. getSupabaseClient() fora do withTimeout
//  [v2.1] 7. Cast supabase.rpc: direto → `as unknown as` (evita erro TS strict)
//  [v2.1] 8. withTimeout: Promise<T> → PromiseLike<T> (aceita PostgrestFilterBuilder)
const HYDRATION_TIMEOUT_MS = 7_000;
const HYDRATION_MAX_RETRIES = 2;
const HYDRATION_RETRY_DELAY_MS = 500;

/**
 * Aguarda uma Promise (ou PromiseLike) com timeout.
 * Aceita PromiseLike para compatibilidade com PostgrestFilterBuilder do Supabase.
 * BUG-FIX v2.1: assinatura alterada de Promise<T> → PromiseLike<T>.
 */
function withTimeout<T>(
  promise: PromiseLike<T>,
  ms: number,
  label: string,
): Promise<T> {
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

// BUG-FIX v2.1: tipo explícito para o cast de supabase.rpc (evita erro TS)
// que ocorre com cast direto entre tipos de função incompatíveis sem `unknown`.
type RPCCallerFn = (
  fn: string,
  args: Record<string, unknown>,
) => Promise<{ data: RPCProfileAndRoles | null; error: PostgrestError | null }>;

export function useProfileRoles() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userRoles, setUserRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [rolesLoaded, setRolesLoaded] = useState(false);

  // fetchPromiseRef: Promise de dedup — nula quando nenhuma busca está em andamento.
  const fetchPromiseRef = useRef<Promise<void> | null>(null);
  // fetchGenerationRef: invalida resultados de buscas obsoletas (sign-out concorrente).
  const fetchGenerationRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchAttemptsRef = useRef(0);
  const fetchUserDataRef = useRef<((userId: string) => Promise<void>) | null>(null);

  const fetchUserData = useCallback(async (userId: string) => {
    // BUG-FIX v2: verifica ANTES de criar Promise para não vazar Promise órfã.
    // Na versão anterior: Promise criada antes do check → resolvePromise()
    // nunca chamada no caminho de dedup → memory leak sutil.
    if (fetchPromiseRef.current) {
      await fetchPromiseRef.current;
      return;
    }

    // Cria Promise de dedup SINCRONAMENTE antes de qualquer await.
    // Chamadas concorrentes que chegarem enquanto doFetch() corre encontrarão
    // fetchPromiseRef.current !== null e tomarão o caminho de dedup acima.
    let resolveDedup!: () => void;
    const dedupPromise = new Promise<void>((resolve) => { resolveDedup = resolve; });
    fetchPromiseRef.current = dedupPromise;
    const myGeneration = ++fetchGenerationRef.current;

    const log = createClientLogger('useProfileRoles.fetchUserData');

    const doFetch = async () => {
      log.info('start', { userId });
      let succeeded = false;
      try {
        // BUG-FIX v2: cliente inicializado ANTES do withTimeout para que a
        // inicialização lazy do singleton não consuma o budget do timer.
        const supabase = await getSupabaseClient();

        // FIX PRINCIPAL: RPC get_profile_and_roles = 1 round-trip vs os
        // 2 anteriores (profiles + user_roles paralelos).
        //
        // BUG-FIX v2.1: cast via `as unknown as RPCCallerFn` para evitar
        // erro TypeScript em strict mode ao converter entre tipos de função
        // incompatíveis (supabase.rpc genérico → assinatura simples).
        const rpcCaller = supabase.rpc as unknown as RPCCallerFn;
        const { data, error } = await withTimeout(
          rpcCaller('get_profile_and_roles', { _user_id: userId }),
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
        // BUG-FIX v2: hydration_timeout é condição ESPERADA (rede lenta /
        // cold start Supabase), não erro crítico.
        // v2.1: log.error → log.warn para timeout; erros reais continuam error.
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
        // Buscas supersedidas não devem zerar o handle nem flipar flags.
        if (fetchGenerationRef.current === myGeneration) {
          fetchPromiseRef.current = null;
          setIsLoading(false);
          setRolesLoaded(true);

          // Agenda retry em background se a busca falhou (timeout/rede).
          // A UI já foi liberada acima; o retry repopula silenciosamente.
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
        // Resolve SEMPRE (mesmo em buscas supersedidas) para desbloquear
        // quem aguarda no caminho de dedup.
        resolveDedup();
      }
    };

    void doFetch();
    // Aguarda a variável local dedupPromise (não fetchPromiseRef.current,
    // que é nulificada antes da resolução no finally do doFetch).
    await dedupPromise;
  }, []);

  const clearProfileRoles = useCallback(() => {
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

  useEffect(() => {
    fetchUserDataRef.current = fetchUserData;
  }, [fetchUserData]);

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
