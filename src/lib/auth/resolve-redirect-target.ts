/**
 * SSOT para resolver o destino pós-login.
 *
 * Mesma função consumida pelo fluxo de e-mail/senha (`Auth.tsx` após `signIn`)
 * e pelo fluxo Google (round-trip OAuth via `SSOCallbackPage` → `Auth.tsx`).
 *
 * Precedência (primeira fonte VÁLIDA vence; demais são descartadas):
 *  1. `location.state.from` — destino capturado pelo guard na mesma aba.
 *  2. `?redirect=/path` — deep-link manual na URL de `/auth`.
 *  3. `sessionStorage` (`consumePostLoginRedirect`) — sobrevive ao round-trip OAuth.
 *  4. fallback `/`.
 *
 * Independente de qual fonte vence, o sessionStorage é SEMPRE consumido
 * (one-shot) para não vazar um destino antigo em logins futuros.
 *
 * Paths inseguros (esquemas, protocol-relative, rotas de auth → loop) são
 * rejeitados por `isSafeRedirectPath` e tratados como ausentes.
 */
import {
  consumePostLoginRedirect,
  isSafeRedirectPath,
  clearPostLoginRedirect,
} from './post-login-redirect';

/**
 * Guarda final defense-in-depth: garante que NENHUM caminho retornado por
 * `resolveRedirectTarget` aponte para uma rota de autenticação, mesmo que
 * uma futura mudança em `isSafeRedirectPath` deixe escapar algum caso.
 * Se a guarda detectar violação, força fallback `/`.
 */
const FALLBACK = '/';
function enforceSafe(target: string): string {
  return isSafeRedirectPath(target) ? target : FALLBACK;
}

export interface RedirectFromState {
  pathname?: string;
  search?: string;
  hash?: string;
}

export interface ResolveRedirectInput {
  /** `location.state.from` (do React Router) */
  fromState?: RedirectFromState | null;
  /** Valor cru do query param `redirect` (ou null) */
  queryRedirect?: string | null;
}

export function resolveRedirectTarget(input: ResolveRedirectInput): string {
  const { fromState, queryRedirect } = input;

  // 1. state.from
  if (fromState?.pathname) {
    const path = `${fromState.pathname}${fromState.search ?? ''}${fromState.hash ?? ''}`;
    if (isSafeRedirectPath(path)) {
      clearPostLoginRedirect(); // descarta storage — precedência maior venceu
      return enforceSafe(path);
    }
  }

  // 2. ?redirect
  if (queryRedirect && isSafeRedirectPath(queryRedirect)) {
    clearPostLoginRedirect();
    return enforceSafe(queryRedirect);
  }

  // 3. sessionStorage (consome one-shot) → 4. fallback '/'
  return enforceSafe(consumePostLoginRedirect(FALLBACK));
}
