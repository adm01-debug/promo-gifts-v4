import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { recordDevRouteTelemetry } from '@/lib/access/dev-route-telemetry';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import {
  Loader2,
  ShieldAlert,
  Send,
  Copy,
  Check,
  ArrowLeft,
  LifeBuoy,
  Users,
  ShoppingCart,
} from 'lucide-react';

import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  requestDevAccess,
  getThrottleStatus,
  DEV_ACCESS_CONTACT_EMAIL,
} from '@/lib/access/request-dev-access';
import { ACCESS_DENIED_STRINGS, type Role } from '@/lib/access/access-denied-strings';
import { generateSecurityId } from '@/lib/access/security-utils';

type LocalButtonVariant = 'default' | 'outline' | 'secondary' | 'ghost' | 'link-secondary';
type LocalButtonSize = 'default' | 'sm';

const localButtonBase =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-bold ring-offset-background transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

const localButtonVariants: Record<LocalButtonVariant, string> = {
  default:
    'border border-primary/20 bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover active:bg-primary-active',
  outline:
    'border-2 border-primary/30 bg-background text-primary hover:border-primary hover:bg-primary/5 active:bg-primary/10',
  secondary:
    'border border-divider bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
  ghost: 'font-bold hover:bg-primary/10 hover:text-primary active:bg-primary/20',
  'link-secondary': 'link-secondary',
};

const localButtonSizes: Record<LocalButtonSize, string> = {
  default: 'h-10 min-h-[44px] px-4 py-2',
  sm: 'h-9 min-h-[36px] px-3',
};

function localButtonClass(
  variant: LocalButtonVariant = 'default',
  size: LocalButtonSize = 'default',
  className?: string,
) {
  return [localButtonBase, localButtonVariants[variant], localButtonSizes[size], className]
    .filter(Boolean)
    .join(' ');
}

export type DevAccessUserRole =
  | 'supervisor'
  | 'agente'
  | 'agent'
  | 'vendedor'
  | string
  | null
  | undefined;

interface DevAccessDeniedPageProps {
  user: { id: string; email?: string | null };
  /** Papel atual do usuário, usado para personalizar copy/CTAs. */
  role: DevAccessUserRole;
  /** Caminho bloqueado (apenas pathname, ex: "/admin/telemetria"). */
  blockedPath: string;
  /** Caminho completo (path + search + hash) para "Tentar novamente". */
  blockedFullPath: string;
  /** State original da location para preservar em "Tentar novamente". */
  blockedState?: unknown;
}

function getRoleCopy(role: DevAccessUserRole, _blockedPath: string) {
  // Normaliza apelidos comuns
  const normalized = role === 'agent' || role === 'vendedor' ? 'agente' : (role ?? 'desconhecido');

  const key = (normalized in ACCESS_DENIED_STRINGS ? normalized : 'desconhecido') as Role;
  const config = ACCESS_DENIED_STRINGS[key];

  return {
    ...config,
    contextualCtaIcon:
      key === 'supervisor' ? (
        <Users className="mr-2 h-4 w-4" />
      ) : key === 'agente' ? (
        <ShoppingCart className="mr-2 h-4 w-4" />
      ) : (
        <ArrowLeft className="mr-2 h-4 w-4" />
      ),
  };
}

/**
 * Página dedicada de "Acesso restrito ao Dev".
 *
 * Diferenciação por papel:
 * - **Supervisor**: copy técnica + CTA primário "Solicitar acesso a Dev" +
 *   atalhos para áreas administrativas (Usuários, Empresas, Configurações).
 * - **Agente/Vendedor**: copy curta orientando voltar ao Catálogo; CTA de
 *   solicitação fica secundário e recomenda falar com o supervisor antes.
 * - **Outros**: fallback genérico.
 *
 * Mantém todas as garantias do DevRoute original: throttle, mailto fallback,
 * link copiável, "Tentar novamente" preservando location state, semântica 403.
 */
export function DevAccessDeniedPage({
  user,
  role,
  blockedPath,
  blockedFullPath,
}: DevAccessDeniedPageProps) {
  const navigate = useNavigate();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const securityId = useMemo(() => generateSecurityId('REQ', blockedPath), [blockedPath]);

  const copy = getRoleCopy(role, blockedPath);
  const isAgente = role === 'agente' || role === 'agent' || role === 'vendedor';
  const isSupervisor = role === 'supervisor';

  // ---- Telemetria de UX (sem PII) -----------------------------------------
  // Marca o instante em que a tela apareceu para calcular o tempo até a ação
  // final (back/retry/fallback/request_access/abandon).
  const viewedAtRef = useRef<number>(Date.now());
  const finalizedRef = useRef<boolean>(false);
  const sinceView = () => Date.now() - viewedAtRef.current;
  const emit = (event: Parameters<typeof recordDevRouteTelemetry>[0]['event']) =>
    void recordDevRouteTelemetry({
      event,
      blockedPath,
      userRole: typeof role === 'string' ? role : null,
      durationMs: sinceView(),
    });
  const finalize = useCallback(
    (event: Parameters<typeof recordDevRouteTelemetry>[0]['event']) => {
      if (finalizedRef.current) return;
      finalizedRef.current = true;
      emit(event);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [blockedPath, role, sinceView],
  );

  // 1) Registra "view" uma única vez ao montar (sem duration).
  useEffect(() => {
    viewedAtRef.current = Date.now();
    void recordDevRouteTelemetry({
      event: 'view',
      blockedPath,
      userRole: typeof role === 'string' ? role : null,
      durationMs: null,
    });
  }, [blockedPath, role]);

  // 2) "abandon" via beacon ao desmontar/fechar a aba sem decisão registrada.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden' && !finalizedRef.current) {
        // Best-effort: a request pode não terminar — coalescing server-side cobre.
        finalize('abandon');
      }
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      if (!finalizedRef.current) finalize('abandon');
    };
  }, [finalize]);

  // -------------------------------------------------------------------------

  const handleRequestAccess = async () => {
    const throttle = getThrottleStatus(user.id);
    if (throttle.throttled) {
      toast.warning('Aguarde um instante', {
        id: 'dev-access-throttle',
        description: `Tente novamente em ${throttle.retryInSeconds}s.`,
      });
      return;
    }
    setSubmitting(true);
    const result = await requestDevAccess({
      userId: user.id,
      userEmail: user.email,
      blockedPath,
      reason,
    });
    setSubmitting(false);

    if (result.throttled) {
      toast.warning('Aguarde um instante', {
        id: 'dev-access-throttle',
        description: `Tente novamente em ${result.retryInSeconds ?? 60}s.`,
      });
      return;
    }
    if (!result.ok) {
      toast.error('Falha ao enviar solicitação', {
        id: 'dev-access-error',
        description: result.error ?? 'Tente novamente em instantes.',
      });
      return;
    }
    toast.success('Solicitação enviada', {
      id: 'dev-access-sent',
      description: `Time técnico avisado (${DEV_ACCESS_CONTACT_EMAIL}).`,
    });
    finalize('request_access');
    if (result.mailtoUrl) {
      window.location.href = result.mailtoUrl;
    }
  };

  const handleCopyLink = async () => {
    try {
      const url = `${window.location.origin}${blockedPath}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Link copiado', {
        id: 'dev-access-link-copied',
        description: 'Envie ao time técnico.',
      });
      emit('copy_link');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Falha ao copiar link', { id: 'dev-access-link-error' });
    }
  };

  const requestButton = (
    <button
      type="button"
      onClick={handleRequestAccess}
      disabled={submitting}
      className={localButtonClass(isAgente ? 'outline' : 'default', 'default', 'w-full')}
    >
      {submitting ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Send className="mr-2 h-4 w-4" />
      )}
      {isAgente ? 'Solicitar via Suporte' : 'Solicitar acesso a Dev'}
    </button>
  );

  return (
    <>
      <Helmet>
        <title>403 — Acesso restrito ao Dev</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="x-http-status" content="403" />
      </Helmet>
      <div
        role="alert"
        data-testid="app-access-denied"
        data-http-status="403"
        data-user-role={role}
        className="flex min-h-screen items-center justify-center bg-background px-4 py-8"
      >
        <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
          <div className="relative">
            <div className="absolute inset-0 animate-pulse rounded-full bg-destructive/10 blur-xl" />
            <ShieldAlert className="relative z-10 h-16 w-16 text-destructive" />
          </div>

          <div className="w-full space-y-4">
            <div className="space-y-1">
              <span className="inline-block rounded-full border border-destructive/20 bg-destructive/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-destructive">
                {copy.badge} · 403
              </span>
              <h1
                id="dev-access-denied-title"
                className="text-2xl font-bold tracking-tight text-foreground"
              >
                {copy.title}
              </h1>
            </div>

            <div className="space-y-3">
              <p className="px-2 text-sm leading-relaxed text-muted-foreground">{copy.intro}</p>

              {isSupervisor && (
                <div className="mx-auto max-w-sm rounded-lg border border-border/50 bg-muted/40 p-3 text-left text-xs">
                  <p className="mb-1 font-medium text-foreground">Nota de Permissão:</p>
                  <p className="leading-normal text-muted-foreground">
                    Seus privilégios administrativos estão configurados para gestão de negócio e
                    usuários. O acesso a ferramentas de infraestrutura e telemetria é restrito.
                  </p>
                </div>
              )}
            </div>

            <div className="border-t border-border/10 pt-2">
              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/50">
                Identificador de Segurança
              </p>
              <p className="mt-1 inline-block rounded bg-muted/30 px-2 py-1 font-mono text-xs text-muted-foreground">
                {securityId}
              </p>
            </div>
          </div>

          {/* Para supervisor: atalhos visuais para áreas administrativas. */}
          {isSupervisor && (
            <div className="w-full border-t border-border/40 pt-2">
              <p className="mb-3 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/50">
                Atalhos Administrativos
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/admin/usuarios')}
                  className={localButtonClass('outline', 'sm', 'h-8 text-xs')}
                >
                  Usuários
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/admin/cadastros')}
                  className={localButtonClass('outline', 'sm', 'h-8 text-xs')}
                >
                  Cadastros
                </button>
              </div>
            </div>
          )}

          <div className="w-full rounded-lg border border-border/60 bg-muted/20 p-3 text-left">
            <p className="text-[10px] leading-relaxed text-muted-foreground">{copy.hint}</p>
          </div>

          {/* Bloco de motivo + CTA de solicitação (todos os papéis podem
              pedir, mas o tom muda — ver requestButton). */}
          <div className="w-full space-y-2 text-left">
            <label htmlFor="dev-access-reason" className="text-xs font-medium text-foreground">
              Motivo (opcional)
            </label>
            <Textarea
              id="dev-access-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 500))}
              placeholder={
                isAgente
                  ? 'Ex.: precisei conferir um log que o supervisor pediu.'
                  : 'Ex.: investigar lentidão no catálogo após a release de hoje.'
              }
              rows={3}
              className="resize-none"
              disabled={submitting}
            />
            <div className="text-right text-[10px] text-muted-foreground">{reason.length}/500</div>
          </div>

          <div className="flex w-full flex-col gap-2 pt-2">
            {requestButton}

            {/* Tentar novamente — útil quando o papel acabou de ser elevado e
                o usuário quer revalidar a rota sem digitar URL de novo. */}
            <button
              type="button"
              onClick={() => {
                finalize('retry');
                navigate(blockedFullPath, { replace: true });
              }}
              className={localButtonClass('secondary', 'default', 'h-9 gap-2')}
            >
              Tentar novamente
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  finalize('back');
                  // Agente/vendedor → catálogo (área principal de trabalho).
                  // Outros papéis → histórico (mantém UX existente).
                  if (isAgente) {
                    navigate('/catalogo');
                  } else {
                    navigate(-1);
                  }
                }}
                className={localButtonClass('ghost', 'default', 'h-9 gap-2')}
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </button>
              <button
                type="button"
                onClick={handleCopyLink}
                className={localButtonClass('outline', 'default', 'h-9 gap-2')}
              >
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                Link
              </button>
            </div>

            <a
              className={localButtonClass('link-secondary', 'sm', 'h-auto py-1 text-[10px]')}
              onClick={() => emit('mail')}
              href={`mailto:${DEV_ACCESS_CONTACT_EMAIL}?subject=${encodeURIComponent(
                `[Promo Gifts] Acesso técnico — ${securityId}`,
              )}&body=${encodeURIComponent(
                `Olá, equipe técnica.\n\nGostaria de solicitar acesso técnico.\n\nIdentificador: ${securityId}\n\nMotivo: ${reason || '(não informado)'}\n\nObrigado.`,
              )}`}
            >
              <LifeBuoy className="mr-1.5 h-3 w-3" />
              Solicitar via Suporte
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
