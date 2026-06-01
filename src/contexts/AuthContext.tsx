import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { type User, type Session, type AuthError } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/integrations/supabase/lazy-client';
import { createClientLogger } from '@/lib/telemetry/structuredLogger';
import { checkLoginAllowed, recordFailedAttempt, clearLoginAttempts } from '@/lib/auth/rate-limit';
import { toast } from 'sonner';
import {
  getRandomGreeting,
  getHighestRole,
  isSupervisorOrAbove as checkIsSupervisorOrAbove,
} from '@/lib/auth/auth-utils';
import { authService } from '@/services/authService';
import { useProfileRoles } from '@/hooks/auth/useProfileRoles';
import { useAuthMFA } from '@/hooks/auth/useAuthMFA';
import { setSafeToastRoles } from '@/lib/security/safeToast';
import { isSupabaseLighthousePlaceholder } from '@/lib/env/supabase-placeholder';

// Tipos de role conforme app_role enum no banco.
export type AppRole =
  | 'dev'
  | 'supervisor'
  | 'agente'
  | 'coordenador'
  | 'admin'
  | 'manager'
  | 'vendedor';

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
  signIn: (
    email: string,
    password: string,
  ) => Promise<{
    error: AuthError | { message: string; status?: number } | null;
    data: { user: User | null; session: Session | null } | null;
  }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const {
    profile,
    userRoles,
    isLoading,
    setIsLoading,
    rolesLoaded,
    fetchUserData,
    clearProfileRoles,
    fetchPromiseRef,
  } = useProfileRoles();
  const { currentAAL, nextAAL, hasMFA, fetchAAL, clearMFA } = useAuthMFA();
  const mountedRef = useRef(true);

  const refreshSession = useCallback(async () => {
    if (fetchPromiseRef.current) {
      await fetchPromiseRef.current;
      return;
    }
    const log = createClientLogger('auth.refreshSession');
    log.info('start');
    try {
      const supabase = await getSupabaseClient();
      const { data, error: _error } = await supabase.auth.refreshSession();
      const nextSession = data?.session ?? (await supabase.auth.getSession()).data.session;
      if (mountedRef.current) {
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
      }
      const uid = nextSession?.user?.id ?? user?.id;
      if (uid) {
        await Promise.all([fetchUserData(uid), fetchAAL()]);
      }
      log.info('ok');
    } catch (err) {
      log.error('failed', { err: String(err) });
    }
  }, [user, fetchUserData, fetchAAL, fetchPromiseRef]);

  useEffect(() => {
    mountedRef.current = true;

    if (isSupabaseLighthousePlaceholder()) {
      setSession(null);
      setUser(null);
      clearProfileRoles();
      clearMFA();
      return () => {
        mountedRef.current = false;
      };
    }

    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    void getSupabaseClient().then((supabase) => {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          if (event === 'SIGNED_IN') {
            const name = session.user.user_metadata?.full_name?.split(' ')[0] || 'Usuário';
            toast.success(`🤖 Flow`, { description: getRandomGreeting(name), duration: 3000 });
          }
          // Use Promise.resolve().then to avoid potential issues with immediate state updates in event handler
          Promise.resolve().then(() => {
            if (session.user) {
              fetchUserData(session.user.id);
              fetchAAL();
              import('@/lib/external-db-prewarm').then((m) =>
                m.prewarmExternalDb({ oncePerSession: true }),
              );
            }
          });
        } else {
          clearProfileRoles();
          clearMFA();
        }
      });

      if (cancelled) {
        subscription.unsubscribe();
        return;
      }

      unsubscribe = () => subscription.unsubscribe();

      supabase.auth.getSession().then(({ data: { session } }) => {
        if (cancelled) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchUserData(session.user.id);
          fetchAAL();
        } else {
          setIsLoading(false);
        }
      });
    });

    return () => {
      mountedRef.current = false;
      cancelled = true;
      unsubscribe?.();
    };
  }, [fetchUserData, fetchAAL, clearProfileRoles, clearMFA, setIsLoading]);

  // Watchdog & Auto-refresh
  useEffect(() => {
    if (!session) return;
    const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
    const now = Date.now();
    const timeToExpiry = expiresAt - now;

    const buffer = 5 * 60 * 1000;
    const refreshDelay = timeToExpiry - buffer;

    // Expiração conhecida e já dentro da janela de buffer (≤5min): refaz uma
    // única vez agora. Se `expires_at` for desconhecido (timeToExpiry≤0), NÃO
    // força refresh — o autoRefreshToken do Supabase cuida disso (evita loop de
    // refresh quando a sessão não traz expiry). Antes havia um refresh imediato
    // (timeToExpiry < 10min) somado a um setTimeout com delay potencialmente
    // negativo (dispara em 0ms) → duplo refresh redundante.
    if (timeToExpiry > 0 && refreshDelay <= 0) {
      refreshSession();
    }

    const warningTime = timeToExpiry - 2 * 60 * 1000;
    let warningTimer: number | null = null;
    if (warningTime > 0) {
      warningTimer = window.setTimeout(() => {
        toast.warning('Sessão prestes a expirar', {
          description: 'Sua sessão encerrará em 2 minutos.',
          action: { label: 'Renovar', onClick: () => refreshSession() },
        });
      }, warningTime);
    }

    const refreshTimer =
      refreshDelay > 0 ? window.setTimeout(() => refreshSession(), refreshDelay) : null;

    return () => {
      if (warningTimer) window.clearTimeout(warningTimer);
      if (refreshTimer) window.clearTimeout(refreshTimer);
    };
  }, [session, refreshSession]);

  // Sync safeToast
  useEffect(() => {
    setSafeToastRoles(userRoles);
  }, [userRoles]);

  // Watchdog (Etapa 8): se isLoading travar (network error, edge function timeout, RLS hang),
  // força isLoading=false. Threshold aumentado de 8s → 12s porque com a remoção do
  // getSession() redundante em fetchUserData, cold starts de Vercel + Supabase ficam
  // dentro de ~3-4s. O threshold de 12s garante cobertura sem falsos positivos.
  useEffect(() => {
    if (!isLoading) return;
    const timer = window.setTimeout(() => {
      console.warn('[AuthContext] Watchdog: isLoading travado por 12s — forçando false');
      setIsLoading(false);
      // BUG-FIX: Se travar, avisa o usuário que algo está errado
      toast.error(
        'O carregamento está demorando mais que o esperado. Algumas funcionalidades podem estar indisponíveis.',
      );
    }, 12000);
    return () => window.clearTimeout(timer);
  }, [isLoading, setIsLoading]);

  const signIn = useCallback(async (email: string, password: string) => {
    const log = createClientLogger('auth.signIn', { base: { email_domain: email.split('@')[1] } });
    const { allowed, remainingSeconds } = checkLoginAllowed(email);
    if (!allowed) {
      return {
        error: {
          message: `Bloqueado. Tente em ${Math.ceil(remainingSeconds / 60)} min.`,
          status: 429,
        },
        data: null,
      };
    }

    const { data, error } = await authService.signIn(email, password);
    if (error) {
      recordFailedAttempt(email);
    } else {
      clearLoginAttempts(email);
    }

    getSupabaseClient()
      .then((supabase) =>
        supabase.functions.invoke('log-login-attempt', {
          body: {
            email,
            user_id: data?.user?.id,
            success: !error,
            failure_reason: error?.message,
            user_agent: navigator.userAgent,
          },
          headers: log.headers(),
        }),
      )
      .catch(() => {});

    return { error, data };
  }, []);

  const signOut = useCallback(async () => {
    try {
      await authService.signOut();
    } finally {
      setUser(null);
      setSession(null);
      clearProfileRoles();
      clearMFA();
      import('@/lib/external-db-prewarm').then((m) => m.resetPrewarmSession()).catch(() => {});
    }
  }, [clearProfileRoles, clearMFA]);

  const isSupervisorOrAbove = checkIsSupervisorOrAbove(userRoles);
  const value: AuthContextType = useMemo(
    () => ({
      user,
      session,
      profile,
      isLoading,
      roles: userRoles,
      role: getHighestRole(userRoles),
      isDev: userRoles.includes('dev'),
      isSupervisor: userRoles.some((r) => ['supervisor', 'admin', 'manager'].includes(r)),
      isAgente: userRoles.some((r) => ['agente', 'vendedor'].includes(r)),
      isSupervisorOrAbove,
      isAdmin: isSupervisorOrAbove,
      isManager: userRoles.includes('manager'),
      isSeller: userRoles.some((r) => ['agente', 'vendedor'].includes(r)),
      canManage: isSupervisorOrAbove,
      isAuthenticated: !!user,
      currentAAL,
      nextAAL,
      hasMFA,
      mfaRequired: isSupervisorOrAbove && currentAAL !== 'aal2',
      rolesLoaded,
      refreshAAL: fetchAAL,
      signIn,
      signOut,
      refreshSession,
      refreshProfile: async () => {
        if (user) {
          fetchPromiseRef.current = null;
          await fetchUserData(user.id);
        }
      },
    }),
    [
      user,
      session,
      profile,
      isLoading,
      userRoles,
      isSupervisorOrAbove,
      currentAAL,
      nextAAL,
      hasMFA,
      fetchAAL,
      signIn,
      signOut,
      refreshSession,
      fetchUserData,
      fetchPromiseRef,
      rolesLoaded,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
