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
  const fetchCancelledRef = useRef(false);

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

    fetchCancelledRef.current = false;

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

        // Aborted while in flight (e.g. signOut → clearProfileRoles): do NOT
        // repopulate the profile/roles that were just cleared. fetchCancelledRef
        // is reset to false at the start of each new fetch, so a subsequent
        // login re-enables state updates.
        if (fetchCancelledRef.current) return;

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
        fetchPromiseRef.current = null;
        // BUG-FIX: Ensure loading is ALWAYS disabled after first attempt
        // to prevent white-screen of death if DB calls fail. Skipped when the
        // fetch was aborted (clearProfileRoles already set the cleared state).
        if (!fetchCancelledRef.current) {
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
    fetchCancelledRef.current = true;
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
    fetchUserData,
    clearProfileRoles,
    fetchPromiseRef,
  };
}
