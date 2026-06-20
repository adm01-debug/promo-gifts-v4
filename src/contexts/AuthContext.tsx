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
import { clearPostLoginRedirect } from '@/lib/auth/post-login-redirect';
import { isSupabaseLighthousePlaceholder } from '@/lib/env/supabase-placeholder';
import {
  attachSessionRevalidation,
  isBadJwtError,
  recoverSession,
} from '@/lib/auth/session-recovery';

import { logger } from '@/lib/logger';
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

// BUG-3 FIX: eventos que efetivamente alteram os dados do usuário (perfil +
// roles). TOKEN_REFRESHED troca apenas o JWT, não os dados — não precisa
// rebuscar profile/roles a cada refresh de ~5 min.
const EVENTS_THAT_NEED_PROFILE_FETCH = new Set(['SIGNED_IN', 'INITIAL_SESSION', 'USER_UPDATED']);

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
      const { data, error } = await supabase.auth.refreshSession();

      // BUG-CRÍTICO FIX: kid rotacionado / bad_jwt → recovery agressiva.
      // Antes, o erro era descartado silenciosamente e o usuário ficava
      // logado no client mas deslogado no server até reabrir a aba.
      if (error && isBadJwtError(error)) {
        log.warn('bad_jwt_detected', { err: error.message });
        await recoverSession('refreshSession:bad_jwt');
        return;
      }

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
      if (isBadJwtError(err)) {
        await recoverSession('refreshSession:exception');
      }
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

    // BUG-CRÍTICO FIX: listeners de revalidação para casos de rotação de
    // signing keys (kid antigo no token persistido). Re-checa contra o servidor
    // em focus/online/visibility e dispara recovery se detectar bad_jwt.
    const detachRevalidation = attachSessionRevalidation();

    void getSupabaseClient().then((supabase) => {
      // BUG-2 FIX: flag local para coordenar onAuthStateChange com getSession().
      // onAuthStateChange dispara INITIAL_SESSION antes de getSession() resolver;
      // sem essa flag, ambos chamam fetchUserData para o mesmo userId, resultando
      // em duas requests idênticas em ~300ms de intervalo.
      let initialFetchScheduled = false;

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          if (event === 'SIGNED_IN') {
            const name = newSession.user.user_metadata?.full_name?.split(' ')[0] || 'Usuário';
            toast.success(`🤖 Flow`, { description: getRandomGreeting(name), duration: 3000 });
          }

          // BUG-3 FIX: só rebuscar perfil/roles em eventos que efetivamente
          // alteram os dados do usuário. TOKEN_REFRESHED ocorre a cada ~5min e
          // troca apenas o JWT — não precisa rebater no banco toda vez.
          const uid = newSession.user.id;
          if (EVENTS_THAT_NEED_PROFILE_FETCH.has(event)) {
            initialFetchScheduled = true;
            // Use Promise.resolve().then to avoid potential issues with immediate state updates in event handler
            Promise.resolve().then(() => {
              if (uid) {
                fetchUserData(uid);
                fetchAAL();
                import('@/lib/external-db-prewarm').then((m) =>
                  m.prewarmExternalDb({ oncePerSession: true }),
                );
              }
            });
          } else {
            // TOKEN_REFRESHED, PASSWORD_RECOVERY, MFA_CHALLENGE_VERIFIED, etc.
            // Só refresca AAL sem rebater no banco.
            fetchAAL();
          }
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

      supabase.auth.getSession().then(async ({ data: { session: authSession } }) => {
        if (cancelled) return;
        setSession(authSession);
        setUser(authSession?.user ?? null);
        if (authSession?.user) {
          // BUG-CRÍTICO FIX: revalida o token no boot. Se o kid foi rotacionado
          // enquanto a aba estava fechada, getUser() retorna bad_jwt e disparamos
          // recovery antes de hidratar dados/papéis com um token quebrado.
          try {
            const { error: getUserError } = await supabase.auth.getUser();
            if (isBadJwtError(getUserError)) {
              await recoverSession('boot:getUser');
              return;
            }
          } catch {
            /* getUser falhou por rede — segue fluxo normal */
          }

          // BUG-2 FIX: onAuthStateChange(INITIAL_SESSION) já agendou
          // fetchUserData via Promise.resolve().then acima. Só buscar aqui
          // se o listener ainda não disparou (ex.: Supabase não emitiu
          // INITIAL_SESSION antes de getSession() resolver).
          if (!initialFetchScheduled) {
            fetchUserData(authSession.user.id);
            fetchAAL();
          }
        } else {
          setIsLoading(false);
        }
      });
    });

    return () => {
      mountedRef.current = false;
      cancelled = true;
      unsubscribe?.();
      detachRevalidation();
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

  useEffect(() => {
    if (!isLoading) return;
    const timer = window.setTimeout(() => {
      const log = createClientLogger('auth.watchdog');
      log.warn('isLoading_stalled_forcing_false', { duration: '8s' });
      setIsLoading(false);
      toast.error(
        'O carregamento está demorando mais que o esperado. Algumas funcionalidades podem estar indisponíveis.',
      );
    }, 8000);
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
      .then(async (supabase) => {
        const { error: invokeError } = await supabase.functions.invoke('log-login-attempt', {
          body: {
            email,
            user_id: data?.user?.id,
            success: !error,
            failure_reason: error?.message,
            user_agent: navigator.userAgent,
          },
          headers: log.headers(),
        });

        if (invokeError) {
          const invokeStatus = (invokeError as { status?: number }).status;
          log.error('log_login_attempt_failed', {
            error: invokeError.message,
            status: invokeStatus,
            requestId: log.requestId,
          });

          if (isBadJwtError(invokeError) || invokeStatus === 401) {
            toast.error(
              'Erro de autenticação na função de auditoria. Verifique a conexão com o projeto canônico.',
              {
                description: `Request ID: ${log.requestId}`,
              },
            );
          }
        } else {
          log.info('log_login_attempt_ok', { requestId: log.requestId });
        }
      })
      .catch((err) => {
        log.error('log_login_attempt_exception', { err: String(err) });
      });

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
      clearPostLoginRedirect();
      try {
        window.sessionStorage.removeItem('catalog:sortBy');
      } catch {
        /* sessionStorage indisponível — ignora */
      }
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

const FALLBACK_AUTH: AuthContextType = {
  user: null,
  session: null,
  profile: null,
  isLoading: false,
  roles: [],
  role: null,
  isDev: false,
  isSupervisor: false,
  isAgente: false,
  isSupervisorOrAbove: false,
  isAdmin: false,
  isManager: false,
  isSeller: false,
  canManage: false,
  isAuthenticated: false,
  currentAAL: null,
  nextAAL: null,
  hasMFA: false,
  mfaRequired: false,
  rolesLoaded: false,
  refreshAAL: async () => {},
  signIn: async () => ({ error: { message: 'AuthProvider indisponível' }, data: null }),
  signOut: async () => {},
  refreshProfile: async () => {},
  refreshSession: async () => {},
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    if (import.meta.env.DEV) {
      logger.warn(
        '[AuthContext] useAuth called outside AuthProvider — using safe fallback. ' +
          'This usually indicates an HMR module-duplication race; a full reload should fix it.',
      );
    }
    return FALLBACK_AUTH;
  }
  return context;
};
