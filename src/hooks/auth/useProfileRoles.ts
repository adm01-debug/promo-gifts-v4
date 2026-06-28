import { useState, useCallback, useRef, useEffect } from 'react';
import { getSupabaseClient } from '@/integrations/supabase/lazy-client';
import { authService } from '@/services/authService';
import { type AppRole, type Profile } from '@/contexts/AuthContext';
import { createClientLogger } from '@/lib/telemetry/structuredLogger';

// BUG-AUTH-STALL FIX (2026-06-28): limites de tempo para a hidratação de
// perfil+roles. O timeout (5s) dispara ANTES do watchdog de 8s do AuthContext,
// liberando a UI de forma graciosa (sem o toast de erro assustador). Quando a
// rede normaliza, um retry em background repopula perfil/roles silenciosamente.
const HYDRATION_TIMEOUT_MS = 5000;
const HYDRATION_MAX_RETRIES = 2;
const HYDRATION_RETRY_DELAY_MS = 800;

/**
 * Resolve com a Promise original, ou rejeita após `ms` ms. Limpa o próprio timer
 * ao assentar para não vazar timeouts nem disparar após a conclusão.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`hydration_timeout:${label}:${ms}ms`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export function useProfileRoles() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userRoles, setUserRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [rolesLoaded, setRolesLoaded] = useState(false);
  const fetchPromiseRef = useRef<Promise<void> | null>(null);
  // Generation token: bumped on every fresh fetch and on clearProfileRoles, so a fetch
  // aborted by sign-out — or a stale one racing a subsequent sign-in — neither repopulates
  // nor clobbers the current login's state. Replaces a boolean cancel flag that left
  // rolesLoaded stuck false on a quick sign-out → sign-in (admin pages stuck loading).
  const fetchGenerationRef = useRef(0);
  // BUG-AUTH-STALL FIX (2026-06-28): timer do retry em background, contador de
  // tentativas e ref estável apontando para a própria fetchUserData (evita ciclo
  // de dependência no useCallback ao reagendar a si mesma).
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchAttemptsRef = useRef(0);
  const fetchUserDataRef = useRef<((userId: string) => Promise<void>) | null>(null);

  const fetchUserData = useCallback(async (userId: string) => {
    // BUG-FIX: Previne race condition setando a Promise síncronamente
    let resolvePromise: (value: PromiseLike<void> | void) => void = () => {};
    const fetchPromise = new Promise<void>((resolve) => {
      resolvePromise = resolve;
    });

    if (fetchPromiseRef.current) {
      await fetchPromiseRef.current;
      return;
    }

    fetchPromiseRef.current = fetchPromise;
    const myGeneration = ++fetchGenerationRef.current;

    const log = createClientLogger('useProfileRoles.fetchUserData');
    const doFetch = async () => {
      log.info('start', { userId });
      let succeeded = false;
      try {
        const supabase = await getSupabaseClient();

        // Fetch profile and roles in parallel.
        // BUG-AUTH-STALL FIX (2026-06-28): com timeout limitado (5s) para nunca
        // travar a hidratação atrás de um round-trip lento. O timeout cai no catch
        // abaixo, que (no finally) agenda um retry em background.
        const [profileResult, rolesResult] = await withTimeout(
          Promise.all([
            supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
            authService.queryRoles(userId),
          ]),
          HYDRATION_TIMEOUT_MS,
          'profile+roles',
        );

        // Superseded while in flight (signOut → clearProfileRoles, or a newer fetch for a
        // fresh login): do NOT repopulate the profile/roles. A newer generation owns the
        // state from here on.
        if (fetchGenerationRef.current !== myGeneration) return;

        if (profileResult.error) {
          log.error('profile_error', { error: profileResult.error });
          // BUG-FIX: Se houver erro de RLS (42501), exibe toast claro
          if (profileResult.error.code === '42501') {
            const { toast } = await import('sonner');
            toast.error('Erro de permissão ao carregar perfil', {
              description: 'O sistema não conseguiu ler seus dados básicos. Contate o suporte.',
            });
          }
        } else {
          setProfile(profileResult.data as Profile | null);
        }

        if (rolesResult.error) {
          log.error('roles_error', { error: rolesResult.error });
          setUserRoles([]);
          // BUG-FIX: Se houver erro de RLS (42501), exibe toast claro
          if (rolesResult.error.code === '42501') {
            const { toast } = await import('sonner');
            toast.error('Erro de permissão ao carregar permissões', {
              description: 'O sistema não conseguiu verificar seus acessos. Contate o suporte.',
            });
          }
        } else {
          const mapped = (rolesResult.data ?? []).map(
            (row: { role: string }) => row.role,
          ) as AppRole[];
          setUserRoles(mapped);
        }

        log.info('done', {
          userId,
          roleCount: rolesResult.data?.length ?? 0,
        });

        // Round-trip concluído dentro do tempo: dados (ou erro de RLS) chegaram.
        // Marca sucesso para NÃO reagendar retry — retry só faz sentido para
        // timeout/falha de rede, não para 42501 (reexecutar não resolveria).
        succeeded = true;
        fetchAttemptsRef.current = 0;
      } catch (error) {
        log.error('exception', { error });
      } finally {
        // Only the current generation owns the shared state/handle. A superseded fetch must
        // not null the new fetch's promise handle nor flip loading flags — doing so is what
        // left the white-screen / stuck-loading bug on a quick sign-out → sign-in. The
        // current generation ALWAYS disables loading so a failed DB call can't hang the UI.
        if (fetchGenerationRef.current === myGeneration) {
          fetchPromiseRef.current = null;
          setIsLoading(false);
          setRolesLoaded(true);

          // BUG-AUTH-STALL FIX (2026-06-28): se a hidratação falhou (timeout/rede)
          // e ainda há tentativas, reagenda um retry em background. A UI já foi
          // liberada acima (loading=false / rolesLoaded=true); o retry repopula
          // perfil/roles silenciosamente quando a rede voltar. O generation guard
          // descarta o resultado se um signOut/login concorrente ocorrer no meio.
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
        resolvePromise();
      }
    };

    void doFetch();
    await fetchPromise;
  }, []);

  const clearProfileRoles = useCallback(() => {
    // Invalidate any in-flight fetch and release the dedup handle so a later sign-in starts
    // a fresh fetch instead of awaiting (and piggy-backing on) the aborted one.
    fetchGenerationRef.current++;
    fetchPromiseRef.current = null;
    // BUG-AUTH-STALL FIX (2026-06-28): cancela qualquer retry de hidratação
    // pendente e zera o contador de tentativas (o bump de generation acima já
    // invalida resultados em voo).
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

  // BUG-AUTH-STALL FIX (2026-06-28): mantém uma ref estável apontando para a
  // fetchUserData mais recente, para o retry agendado poder se reinvocar sem
  // criar um ciclo de dependência no useCallback.
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
    setRolesLoaded, // BUG-WATCHDOG-ROLES FIX (2026-06-23): exposto para o watchdog do AuthContext poder forçar rolesLoaded=true em stall
    fetchUserData,
    clearProfileRoles,
    fetchPromiseRef,
  };
}
