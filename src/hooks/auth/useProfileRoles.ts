import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { authService } from '@/services/authService';
import { authDebug, authDebugError } from '@/lib/auth/auth-debug';
import { type AppRole, type Profile } from '@/contexts/AuthContext';

export function useProfileRoles() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userRoles, setUserRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const fetchPromiseRef = useRef<Promise<void> | null>(null);

  const fetchUserData = useCallback(async (userId: string) => {
    if (fetchPromiseRef.current) {
      await fetchPromiseRef.current;
      return;
    }

    const doFetch = async () => {
      authDebug("useProfileRoles.fetchUserData", "start", { userId });
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const sess = sessionData?.session ?? null;
        const sessUserId = sess?.user?.id ?? null;

        if (!sess || !sessUserId || sessUserId !== userId) {
          authDebugError("useProfileRoles.fetchUserData", "ABORT — session mismatch", { 
            userId, sessUserId, hasSession: !!sess 
          });
          return;
        }

        const [profileResult, firstRoles] = await Promise.all([
          authService.fetchProfile(userId),
          authService.queryRoles(userId),
        ]);

        let rolesResult = firstRoles;
        if (!rolesResult.error && (!rolesResult.data || rolesResult.data.length === 0)) {
          authDebug("useProfileRoles.fetchUserData", "user_roles empty — retrying", { userId });
          await new Promise((r) => setTimeout(r, 250));
          rolesResult = await authService.queryRoles(userId);
        }

        if (profileResult.data) {
          setProfile(profileResult.data as Profile);
          // background update
          supabase.from("profiles").update({ last_login_at: new Date().toISOString() }).eq("user_id", userId).then();
        }

        if (rolesResult.data && rolesResult.data.length > 0) {
          setUserRoles(rolesResult.data.map(r => r.role as AppRole));
        }
      } catch (error) {
        authDebugError("useProfileRoles.fetchUserData", "exception", error);
      } finally {
        fetchPromiseRef.current = null;
        setIsLoading(false);
      }
    };

    fetchPromiseRef.current = doFetch();
    await fetchPromiseRef.current;
  }, []);

  const clearProfileRoles = useCallback(() => {
    setProfile(null);
    setUserRoles([]);
    setIsLoading(false);
  }, []);

  return {
    profile,
    setProfile,
    userRoles,
    setUserRoles,
    isLoading,
    setIsLoading,
    fetchUserData,
    clearProfileRoles,
    fetchPromiseRef
  };
}
