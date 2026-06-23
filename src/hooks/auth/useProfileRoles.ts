import { useState, useCallback, useRef } from 'react';
import { getSupabaseClient } from '@/integrations/supabase/lazy-client';
import { authService } from '@/services/authService';
import { type AppRole, type Profile } from '@/contexts/AuthContext';
import { createClientLogger } from '@/lib/telemetry/structuredLogger';

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
      try {
        const supabase = await getSupabaseClient();

        // Fetch profile and roles in parallel
        const [profileResult, rolesResult] = await Promise.all([
          supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
          authService.queryRoles(userId),
        ]);

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
    setProfile(null);
    setUserRoles([]);
    setIsLoading(false);
    setRolesLoaded(false);
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
