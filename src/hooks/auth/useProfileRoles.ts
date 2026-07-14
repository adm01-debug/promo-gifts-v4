import { useState, useCallback, useRef, useEffect } from 'react';
import { getSupabaseClient } from '@/integrations/supabase/lazy-client';
import { type AppRole, type Profile } from '@/contexts/AuthContext';
import { createClientLogger } from '@/lib/telemetry/structuredLogger';
import { asTypedRPC, type GetProfileAndRolesResult } from '@/integrations/supabase/rpc-overrides';
import { useAuthHydrationMetrics } from './useAuthHydrationMetrics';

// AUTH-HYDRATION-FIX v2.2 (2026-07-14):
//  [v2]   1-6: timeout, retry, RPC, warn, dedup, lazy-client fora do timer
//  [v2.1] 7-8: asTypedRPC<T> via rpc-overrides.ts, PromiseLike<T>
//  [v2.2] 9:   instrumentado com useAuthHydrationMetrics (OBS gaps 14-16)
const HYDRATION_TIMEOUT_MS = 7_000;
const HYDRATION_MAX_RETRIES = 2;
const HYDRATION_RETRY_DELAY_MS = 500;

function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`hydration_timeout:${label}:${ms}ms`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

export function useProfileRoles() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userRoles, setUserRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [rolesLoaded, setRolesLoaded] = useState(false);

  const fetchPromiseRef = useRef<Promise<void> | null>(null);
  const fetchGenerationRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchAttemptsRef = useRef(0);
  const fetchUserDataRef = useRef<((userId: string) => Promise<void>) | null>(null);

  // [v2.2] Observabilidade: latencia, taxa de erro, retries
  const { recordHydration, getMetrics, resetMetrics } = useAuthHydrationMetrics();

  const fetchUserData = useCallback(async (userId: string) => {
    if (fetchPromiseRef.current) {
      await fetchPromiseRef.current;
      return;
    }

    let resolveDedup!: () => void;
    const dedupPromise = new Promise<void>((resolve) => { resolveDedup = resolve; });
    fetchPromiseRef.current = dedupPromise;
    const myGeneration = ++fetchGenerationRef.current;
    const isRetry = fetchAttemptsRef.current > 0;

    const log = createClientLogger('useProfileRoles.fetchUserData');

    const doFetch = async () => {
      log.info('start', { userId, isRetry });
      let succeeded = false;
      const t0 = performance.now();

      try {
        const supabase = await getSupabaseClient();

        // [v2.2] asTypedRPC<GetProfileAndRolesResult> elimina cast inline
        const { data, error } = await withTimeout(
          asTypedRPC<GetProfileAndRolesResult>(supabase.rpc)(
            'get_profile_and_roles',
            { _user_id: userId },
          ),
          HYDRATION_TIMEOUT_MS,
          'profile+roles',
        );

        if (fetchGenerationRef.current !== myGeneration) return;

        if (error) {
          log.error('rpc_error', { error });
          if ((error as { code?: string }).code === '42501') {
            const { toast } = await import('sonner');
            toast.error('Erro de permissao ao carregar perfil', {
              description: 'Nao foi possivel ler seus dados. Contate o suporte.',
            });
          }
        } else {
          setProfile(data?.profile ?? null);
          setUserRoles((data?.roles ?? []) as AppRole[]);
          log.info('done', { userId, roleCount: data?.roles?.length ?? 0 });
          succeeded = true;
          fetchAttemptsRef.current = 0;
        }
      } catch (error) {
        const isTimeout = error instanceof Error && error.message.startsWith('hydration_timeout:');
        if (isTimeout) {
          log.warn('hydration_timeout', { userId, error });
        } else {
          log.error('exception', { userId, error });
        }
      } finally {
        // [v2.2] Registra metrica de latencia
        const durationMs = Math.round(performance.now() - t0);
        recordHydration(durationMs, succeeded, isRetry);

        if (fetchGenerationRef.current === myGeneration) {
          fetchPromiseRef.current = null;
          setIsLoading(false);
          setRolesLoaded(true);

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
        resolveDedup();
      }
    };

    void doFetch();
    await dedupPromise;
  }, [recordHydration]);

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
    resetMetrics();
  }, [resetMetrics]);

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
    /** [v2.2] Metricas de observabilidade — para AuthContext ou DevTools */
    getHydrationMetrics: getMetrics,
  };
}
