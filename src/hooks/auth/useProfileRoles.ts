import { useState, useCallback, useRef } from 'react';
import { getSupabaseClient } from '@/integrations/supabase/lazy-client';
import { authService } from '@/services/authService';
import { authDebug, authDebugError } from '@/lib/auth/auth-debug';
import { type AppRole, type Profile } from '@/contexts/AuthContext';

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

    const doFetch = async () => {
      authDebug('useProfileRoles.fetchUserData', 'start', { userId });
      try {
        const supabase = await getSupabaseClient();

        // Fetch profile and roles in parallel
        const [profileResult, rolesResult] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, full_name, avatar_url, email, organization_id')
            .eq('id', userId)
            .maybeSingle(),
          authService.queryRoles(userId),
        ]);

        if (profileResult.error) {
          authDebugError('useProfileRoles.fetchUserData', 'profile error', profileResult.error);
        } else {
          setProfile(profileResult.data);
        }

        if (rolesResult.error) {
          authDebugError('useProfileRoles.fetchUserData', 'roles error', rolesResult.error);
          setUserRoles([]);
        } else {
          const mapped = (rolesResult.data ?? []).map(
            (row: { role: string }) => row.role,
          ) as AppRole[];
          setUserRoles(mapped);
        }

        authDebug('useProfileRoles.fetchUserData', 'done', {
          userId,
          roleCount: rolesResult.data?.length ?? 0,
        });
      } catch (error) {
        authDebugError('useProfileRoles.fetchUserData', 'exception', error);
      } finally {
        fetchPromiseRef.current = null;
        if (!fetchCancelledRef.current) {
          setIsLoading(false);
          setRolesLoaded(true);
        }
      }
    };

    fetchPromiseRef.current = doFetch();
    await fetchPromiseRef.current;
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
