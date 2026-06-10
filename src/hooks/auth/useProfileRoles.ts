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
    if (fetchPromiseRef.current) {
      await fetchPromiseRef.current;
      return;
    }

    fetchCancelledRef.current = false;

    const log = createClientLogger('useProfileRoles.fetchUserData');
    const doFetch = async () => {
      log.info('start', { userId });
      try {
        const supabase = await getSupabaseClient();

        // Fetch profile and roles in parallel
        const [profileResult, rolesResult] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
          authService.queryRoles(userId),
        ]);

        if (profileResult.error) {
          log.error('profile_error', { error: profileResult.error });
        } else {
          setProfile(profileResult.data as Profile | null);
        }

        if (rolesResult.error) {
          log.error('roles_error', { error: rolesResult.error });
          setUserRoles([]);
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
        // to prevent white-screen of death if DB calls fail.
        setIsLoading(false);
        setRolesLoaded(true);
      }
    };

    const promise = doFetch();
    fetchPromiseRef.current = promise;
    await promise;
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
