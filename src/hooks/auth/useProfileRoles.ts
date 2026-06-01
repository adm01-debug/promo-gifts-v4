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

  const fetchUserData = useCallback(async (userId: string) => {
    if (fetchPromiseRef.current) {
      await fetchPromiseRef.current;
      return;
    }

    const doFetch = async () => {
      authDebug('useProfileRoles.fetchUserData', 'start', { userId });
      try {
        // PERF: getSession() removido — AuthContext já valida a sessão antes de chamar
        // fetchUserData(session.user.id), então o round-trip extra ao Supabase Auth é
        // desnecessário. Economia: ~200–500ms por login (1 HTTP call a menos).
        const [profileResult, firstRoles] = await Promise.all([
          authService.fetchProfile(userId),
          authService.queryRoles(userId),
        ]);

        let rolesResult = firstRoles;
        if (!rolesResult.error && (!rolesResult.data || rolesResult.data.length === 0)) {
          authDebug('useProfileRoles.fetchUserData', 'user_roles empty — retrying', { userId });
          // PERF: reduced from 250ms → 100ms
          await new Promise((r) => setTimeout(r, 100));
          rolesResult = await authService.queryRoles(userId);
        }

        if (profileResult.data) {
          const profileData = profileResult.data as Profile;
          setProfile(profileData);

          // background update — fire and forget, com proteção de mount.
          // `.catch` evita unhandled rejection se conexão/escrita falhar (rede/RLS).
          getSupabaseClient()
            .then((supabase) => {
              if (!userId) return;
              return supabase
                .from('profiles')
                .update({ last_login_at: new Date().toISOString() })
                .eq('user_id', userId)
                .then(({ error }) => {
                  if (error) authDebugError('useProfileRoles.updateLastLogin', 'failed', error);
                });
            })
            .catch(() => {
              /* atualização de last_login_at é best-effort */
            });
        }

        if (rolesResult.data && rolesResult.data.length > 0) {
          setUserRoles(rolesResult.data.map((r) => r.role as AppRole));
        }
      } catch (error) {
        authDebugError('useProfileRoles.fetchUserData', 'exception', error);
      } finally {
        fetchPromiseRef.current = null;
        setIsLoading(false);
        setRolesLoaded(true);
      }
    };

    fetchPromiseRef.current = doFetch();
    await fetchPromiseRef.current;
  }, []);

  const clearProfileRoles = useCallback(() => {
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
