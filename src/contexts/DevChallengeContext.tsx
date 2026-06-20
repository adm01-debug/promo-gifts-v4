/**
 * DevChallengeContext — Wrapper reutilizável de "challenge" para liberar
 * operações sensíveis (full scope) com re-checagem server-side de role `dev`.
 *
 * Uso:
 *   const { challenge } = useDevChallenge();
 *   const token = await challenge({
 *     action: "mcp_full_issue",
 *     actionLabel: "Emitir chave MCP com escopo total",
 *     targetRef: keyId,
 *   });
 *   if (!token) return; // usuário cancelou ou foi superado por outra solicitação
 *   await supabase.functions.invoke("mcp-keys-issue", { body: { ..., step_up_token: token }});
 *
 * Toda a verificação real (senha + OTP + role dev) acontece server-side
 * na edge function `step-up-verify`. O token é de uso único e validado
 * via RPC `consume_step_up_token` na edge final.
 *
 * Concorrência:
 *   - Apenas UM modal de challenge fica aberto por vez.
 *   - Se uma nova solicitação chega enquanto outra está pendente, a anterior
 *     é resolvida com `null` (`superseded`) e somente a mais recente pode
 *     produzir um token válido. Isso evita race conditions onde o usuário
 *     dispara duas ações sensíveis em paralelo e a primeira "rouba" o token
 *     destinado à segunda.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { StepUpAuthDialog } from '@/components/auth/StepUpAuthDialog';
import type { StepUpAction } from '@/hooks/auth';

interface ChallengeRequest {
  action: StepUpAction;
  actionLabel: string;
  targetRef?: string | null;
}

interface DevChallengeContextValue {
  /** Abre o modal de step-up. Resolve com o token verificado, ou `null` se cancelado/falhou/superado. */
  challenge: (req: ChallengeRequest) => Promise<string | null>;
}

const DevChallengeContext = createContext<DevChallengeContextValue | null>(null);

interface PendingChallenge extends ChallengeRequest {
  /** Identificador monotônico para garantir que apenas a última solicitação valide o token. */
  requestId: number;
  resolve: (token: string | null) => void;
}

export function DevChallengeProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<PendingChallenge | null>(null);
  const pendingRef = useRef<PendingChallenge | null>(null);
  const requestIdRef = useRef(0);

  const challenge = useCallback((req: ChallengeRequest) => {
    return new Promise<string | null>((resolve) => {
      const requestId = ++requestIdRef.current;
      const pending: PendingChallenge = { ...req, requestId, resolve };

      // Se já houver um challenge pendente, supersedê-lo: resolve com null
      // para que o caller anterior aborte e não consuma um token destinado
      // a esta nova solicitação.
      const previous = pendingRef.current;
      if (previous) {
        try {
          previous.resolve(null);
        } catch {
          /* noop */
        }
      }

      pendingRef.current = pending;
      setCurrent(pending);
      setOpen(true);
    });
  }, []);

  const handleOpenChange = (next: boolean) => {
    if (!next && pendingRef.current) {
      // Fechado sem verificar => cancelado
      const cancelled = pendingRef.current;
      pendingRef.current = null;
      setCurrent(null);
      setOpen(false);
      cancelled.resolve(null);
      return;
    }
    setOpen(next);
  };

  const handleVerified = (token: string, requestId: number) => {
    const pending = pendingRef.current;
    // Apenas a solicitação mais recente pode consumir o token. Se uma nova
    // solicitação superou esta, descartamos o token silenciosamente.
    if (!pending || pending.requestId !== requestId) {
      setOpen(false);
      return;
    }
    pendingRef.current = null;
    setOpen(false);
    setCurrent(null);
    pending.resolve(token);
  };

  const value = useMemo(() => ({ challenge }), [challenge]);

  return (
    <DevChallengeContext.Provider value={value}>
      {children}
      {current && (
        <StepUpAuthDialog
          // Key força remontagem completa quando uma nova solicitação supera a anterior,
          // garantindo que estado interno do dialog (senha digitada, OTP) seja limpo.
          key={current.requestId}
          open={open}
          onOpenChange={handleOpenChange}
          action={current.action}
          targetRef={current.targetRef ?? null}
          actionLabel={current.actionLabel}
          onVerified={(token) => handleVerified(token, current.requestId)}
        />
      )}
    </DevChallengeContext.Provider>
  );
}

export function useDevChallenge(): DevChallengeContextValue {
  const ctx = useContext(DevChallengeContext);
  if (!ctx) {
    throw new Error('useDevChallenge deve ser usado dentro de <DevChallengeProvider>');
  }
  return ctx;
}
