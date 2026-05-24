import { createContext, useContext, useEffect, useState, useRef, useCallback, type ReactNode } from "react";
import { type User, type Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { createClientLogger } from "@/lib/telemetry/structuredLogger";
import { checkLoginAllowed, recordFailedAttempt, clearLoginAttempts } from "@/lib/auth/rate-limit";
import { toast } from "sonner";
import { getRandomGreeting, getHighestRole, isSupervisorOrAbove as checkIsSupervisorOrAbove } from "@/lib/auth/auth-utils";
import { authService } from "@/services/authService";
import { useProfileRoles } from "@/hooks/auth/useProfileRoles";
import { useAuthMFA } from "@/hooks/auth/useAuthMFA";
import { setSafeToastRoles } from "@/lib/security/safeToast";

// Tipos de role conforme app_role enum no banco.
export type AppRole = "dev" | "supervisor" | "agente" | "admin" | "manager" | "vendedor";

export interface Profile {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  avatar_url: string | null;
  phone: string | null;
  department: string | null;
  is_active: boolean | null;
  last_login_at: string | null;
  preferences: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  roles: AppRole[];
  role: AppRole | null;
  isDev: boolean;
  isSupervisor: boolean;
  isAgente: boolean;
  isSupervisorOrAbove: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isSeller: boolean;
  canManage: boolean;
  isAuthenticated: boolean;
  currentAAL: 'aal1' | 'aal2' | null;
  nextAAL: 'aal1' | 'aal2' | null;
  hasMFA: boolean;
  mfaRequired: boolean;
  rolesLoaded: boolean;
  refreshAAL: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: any; data: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const { profile, setProfile, userRoles, setUserRoles, isLoading, setIsLoading, fetchUserData, clearProfileRoles, fetchPromiseRef } = useProfileRoles();
  const { currentAAL, nextAAL, hasMFA, fetchAAL, clearMFA } = useAuthMFA();
  const mountedRef = useRef(true);

  const refreshSession = useCallback(async () => {
    const log = createClientLogger('auth.refreshSession');
    log.info('start');
    try {
      const { data, error } = await supabase.auth.refreshSession();
      const nextSession = data?.session ?? (await supabase.auth.getSession()).data.session;
      if (mountedRef.current) {
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
      }
      const uid = nextSession?.user?.id ?? user?.id;
      if (uid) {
        fetchPromiseRef.current = null;
        await Promise.all([fetchUserData(uid), fetchAAL()]);
      }
      log.info('ok');
    } catch (err) {
      log.error('failed', { err: String(err) });
    }
  }, [user, fetchUserData, fetchAAL, fetchPromiseRef]);

  useEffect(() => {
    mountedRef.current = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        if (event === 'SIGNED_IN') {
          const name = session.user.user_metadata?.full_name?.split(' ')[0] || 'Usuário';
          toast.success(`🤖 Flow`, { description: getRandomGreeting(name), duration: 3000 });
        }
        setTimeout(() => {
          fetchUserData(session.user.id);
          fetchAAL();
          import('@/lib/external-db-prewarm').then(m => m.prewarmExternalDb({ oncePerSession: true }));
        }, 0);
      } else {
        clearProfileRoles();
        clearMFA();
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
        fetchAAL();
      } else {
        setIsLoading(false);
      }
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [fetchUserData, fetchAAL, clearProfileRoles, clearMFA, setIsLoading]);

  // Watchdog & Auto-refresh
  useEffect(() => {
    if (!session) return;
    const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
    const now = Date.now();
    const timeToExpiry = expiresAt - now;

    if (timeToExpiry > 0 && timeToExpiry < 10 * 60 * 1000) refreshSession();

    const warningTime = timeToExpiry - 2 * 60 * 1000;
    let warningTimer: number | null = null;
    if (warningTime > 0) {
      warningTimer = window.setTimeout(() => {
        toast.warning("Sessão prestes a expirar", {
          description: "Sua sessão encerrará em 2 minutos.",
          action: { label: "Renovar", onClick: () => refreshSession() },
        });
      }, warningTime);
    }

    const buffer = 5 * 60 * 1000;
    const refreshTimer = setTimeout(() => refreshSession(), expiresAt - now - buffer);

    return () => {
      if (warningTimer) window.clearTimeout(warningTimer);
      clearTimeout(refreshTimer);
    };
  }, [session, refreshSession]);

  // Sync safeToast
  useEffect(() => {
    setSafeToastRoles(userRoles);
  }, [userRoles]);

  const signIn = async (email: string, password: string) => {
    const log = createClientLogger('auth.signIn', { base: { email_domain: email.split('@')[1] } });
    const { allowed, remainingSeconds } = checkLoginAllowed(email);
    if (!allowed) {
      return { error: { message: `Bloqueado. Tente em ${Math.ceil(remainingSeconds / 60)} min.`, status: 429 }, data: null };
    }

    const { data, error } = await authService.signIn(email, password);
    if (error) {
      recordFailedAttempt(email);
    } else {
      clearLoginAttempts(email);
    }

    supabase.functions.invoke('log-login-attempt', {
      body: { email, user_id: data?.user?.id, success: !error, failure_reason: error?.message, user_agent: navigator.userAgent },
      headers: log.headers(),
    }).catch(() => {});

    return { error, data };
  };

  const signOut = async () => {
    try {
      await authService.signOut();
    } finally {
      setUser(null);
      setSession(null);
      clearProfileRoles();
      clearMFA();
      import('@/lib/external-db-prewarm').then(m => m.resetPrewarmSession()).catch(() => {});
    }
  };

  const isSupervisorOrAbove = checkIsSupervisorOrAbove(userRoles);
  const value: AuthContextType = {
    user, session, profile, isLoading,
    roles: userRoles,
    role: getHighestRole(userRoles),
    isDev: userRoles.includes("dev"),
    isSupervisor: userRoles.some(r => ["supervisor", "admin", "manager"].includes(r)),
    isAgente: userRoles.some(r => ["agente", "vendedor"].includes(r)),
    isSupervisorOrAbove,
    isAdmin: isSupervisorOrAbove,
    isManager: userRoles.includes("manager"),
    isSeller: userRoles.some(r => ["agente", "vendedor"].includes(r)),
    canManage: isSupervisorOrAbove,
    isAuthenticated: !!user,
    currentAAL, nextAAL, hasMFA,
    mfaRequired: isSupervisorOrAbove && currentAAL !== 'aal2',
    rolesLoaded: userRoles.length > 0,
    refreshAAL: fetchAAL,
    signIn, signOut, refreshSession,
    refreshProfile: async () => { if (user) { fetchPromiseRef.current = null; await fetchUserData(user.id); } },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
