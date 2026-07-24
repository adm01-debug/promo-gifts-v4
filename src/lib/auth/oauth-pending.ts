/**
 * Persistência leve do estado "OAuth em andamento" via `sessionStorage`.
 *
 * Motivação: quando o usuário clica em "Continuar com Google", o navegador
 * sai do app (redirect para `accounts.google.com`) e pode voltar:
 *  - direto em `/auth/callback` (sucesso ou erro do provider)
 *  - de volta em `/login` (cancelamento, back-button)
 *  - na mesma aba após `visibilitychange` (popup ou redirect rápido)
 *
 * Sem persistência, o `SocialLoginButtons` perde seu estado React local e
 * renderiza o botão idle por uma fração de segundo antes do `AuthContext`
 * reconciliar — flash visual ruim. Esta SSOT mantém o spinner consistente.
 *
 * Chave: `__oauth_pending` em `sessionStorage` (escopo por aba).
 * Payload: `{ provider, startedAt }` JSON. TTL implícito de 60s — após isso
 * consideramos abandonado (usuário fechou aba do provider sem voltar).
 */

export type OAuthProvider = 'google';

export interface OAuthPendingState {
  provider: OAuthProvider;
  /** Epoch ms quando o redirect foi iniciado. */
  startedAt: number;
}

const STORAGE_KEY = '__oauth_pending';
/** Tempo máximo (ms) que um pending é considerado válido. */
export const OAUTH_PENDING_TTL_MS = 60_000;

/** Marca início do fluxo OAuth. Idempotente — sobrescreve qualquer pending anterior. */
export function markOAuthPending(provider: OAuthProvider): void {
  try {
    const payload: OAuthPendingState = { provider, startedAt: Date.now() };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // sessionStorage indisponível (modo privado iOS, quota): no-op.
  }
}

/** Remove o marcador — chamado em sucesso, falha, ou cancelamento explícito. */
export function clearOAuthPending(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* no-op */
  }
}

/**
 * Retorna o estado pendente se ainda válido (dentro do TTL), ou `null`.
 * Side-effect: se encontrar pending expirado, limpa.
 */
export function readOAuthPending(now: number = Date.now()): OAuthPendingState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OAuthPendingState>;
    if (!parsed || typeof parsed.provider !== 'string' || typeof parsed.startedAt !== 'number') {
      clearOAuthPending();
      return null;
    }
    if (now - parsed.startedAt > OAUTH_PENDING_TTL_MS) {
      clearOAuthPending();
      return null;
    }
    return parsed as OAuthPendingState;
  } catch {
    clearOAuthPending();
    return null;
  }
}
