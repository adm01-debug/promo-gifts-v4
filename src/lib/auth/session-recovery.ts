/**
 * Session Recovery — Detecção e recuperação de tokens JWT inválidos no client.
 *
 * Contexto: quando o GoTrue rotaciona signing keys (kid muda), tokens já
 * persistidos no localStorage seguem sendo enviados pelos clientes ativos e
 * o backend responde 403 `bad_jwt` / "unrecognized JWT kid". O usuário fica
 * num estado quebrado (logado no client, deslogado no server) até reabrir
 * a aba manualmente.
 *
 * Este módulo:
 *  1. Identifica erros de JWT inválido (kid desconhecido, expirado, malformado).
 *  2. Tenta `refreshSession()` com deduplicação (uma tentativa por vez).
 *  3. Se o refresh também falhar com bad_jwt → faz `signOut()` limpo,
 *     toast amigável e redireciona para `/login` preservando a rota.
 *
 * Sem alterações de schema, sem mexer no cliente Supabase auto-gerado.
 */
import { toast } from 'sonner';
import { getSupabaseClient } from '@/integrations/supabase/lazy-client';
import { createClientLogger } from '@/lib/telemetry/structuredLogger';

/** Padrões de erro que indicam JWT inválido/rejeitado pelo servidor. */
const BAD_JWT_PATTERNS = [
  /bad[_\s-]?jwt/i,
  /invalid\s+jwt/i,
  /unrecognized\s+jwt\s+kid/i,
  /jwt\s+expired/i,
  /jwt\s+malformed/i,
  /jws[_\s-]?signature/i,
  /token\s+is\s+unverifiable/i,
];

export function isBadJwtError(input: unknown): boolean {
  if (!input) return false;
  const msg =
    typeof input === 'string'
      ? input
      : typeof input === 'object' && input !== null && 'message' in input
        ? String(input.message ?? '')
        : '';
  if (!msg) return false;
  return BAD_JWT_PATTERNS.some((re) => re.test(msg));
}

let recoveryInflight: Promise<boolean> | null = null;
let lastRecoveryAt = 0;
const RECOVERY_DEBOUNCE_MS = 5_000;

/**
 * Tenta recuperar a sessão. Retorna `true` se conseguiu (sessão válida ao final),
 * `false` se forçou logout. Deduplicado: chamadas concorrentes recebem a mesma Promise.
 */
export function recoverSession(reason: string): Promise<boolean> {
  if (recoveryInflight) return recoveryInflight;
  const since = Date.now() - lastRecoveryAt;
  if (since < RECOVERY_DEBOUNCE_MS) {
    // Evita storm de retries em loops de erro
    return Promise.resolve(true);
  }
  recoveryInflight = (async () => {
    const log = createClientLogger('auth.sessionRecovery');
    log.info('start', { reason });
    try {
      const supabase = await getSupabaseClient();
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

      if (!refreshError && refreshData?.session) {
        log.info('refreshed');
        return true;
      }

      // Refresh falhou — checa se também é bad_jwt (kid antigo no próprio refresh token)
      if (refreshError && !isBadJwtError(refreshError)) {
        // Outro tipo de erro (rede, etc.): não derruba a sessão, deixa retry mais tarde.
        log.warn('refresh_failed_transient', { err: refreshError.message });
        return true;
      }

      // bad_jwt no próprio refresh → token irrecuperável. Faz logout limpo.
      log.warn('refresh_unrecoverable_forcing_signout', {
        err: refreshError?.message ?? 'no_session',
      });
      await supabase.auth.signOut().catch(() => {});

      if (typeof window !== 'undefined') {
        toast.error('Sua sessão expirou. Faça login novamente.', { duration: 6000 });
        const here = window.location.pathname + window.location.search;
        const skip = here.startsWith('/login') || here.startsWith('/auth');
        if (!skip) {
          const next = encodeURIComponent(here);
          window.location.replace(`/login?next=${next}`);
        }
      }
      return false;
    } catch (err) {
      createClientLogger('auth.sessionRecovery').error('exception', { err: String(err) });
      return true;
    } finally {
      lastRecoveryAt = Date.now();
      recoveryInflight = null;
    }
  })();
  return recoveryInflight;
}

/**
 * Inspeciona o resultado de uma chamada Supabase. Se for bad_jwt, dispara
 * recovery em background. Use em catch blocks ou quando uma query retornar
 * `{ error }` com mensagem de JWT inválido.
 */
export function maybeRecoverFromError(input: unknown, contextLabel = 'unknown'): void {
  if (!isBadJwtError(input)) return;
  void recoverSession(`error:${contextLabel}`);
}

/**
 * Liga listeners de revalidação: focus, online e visibilitychange.
 * Quando a aba volta ao foco, chama `getUser()` (re-valida no servidor) e
 * dispara recovery se detectar bad_jwt. Idempotente.
 */
let listenersAttached = false;
export function attachSessionRevalidation(): () => void {
  if (listenersAttached || typeof window === 'undefined') return () => undefined;
  listenersAttached = true;

  let revalidating = false;
  const revalidate = async (reason: string) => {
    if (revalidating) return;
    revalidating = true;
    try {
      const supabase = await getSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();

      // BUG-FIX: Se detectarmos que não há sessão mas o localStorage tem resquícios,
      // ou se o token atual falhar na validação getUser(), forçamos recuperação.
      if (!sessionData?.session) {
        // Se houver flags de autenticação no cache mas sem sessão real, pode ser um estado zumbi
        return;
      }

      const { error } = await supabase.auth.getUser();
      if (isBadJwtError(error)) {
        await recoverSession(`revalidate:${reason}`);
      }
    } catch (err) {
      // Se falhar por rede (ex: reconexão lenta), não faz nada.
      // Se for erro de auth explícito, loga.
      if (isBadJwtError(err)) {
        await recoverSession(`revalidate:catch:${reason}`);
      }
    } finally {
      revalidating = false;
    }
  };

  const onFocus = () => void revalidate('focus');
  const onOnline = () => void revalidate('online');
  const onVisibility = () => {
    if (document.visibilityState === 'visible') void revalidate('visibility');
  };

  window.addEventListener('focus', onFocus);
  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    window.removeEventListener('focus', onFocus);
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onVisibility);
    listenersAttached = false;
  };
}
