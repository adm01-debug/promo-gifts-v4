import { useEffect, useRef, type ReactNode } from 'react';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ErrorKind } from '@/hooks/intelligence';
import { getErrorCopy } from '@/lib/connection-error-copy';
import { inferErrorKind } from '@/lib/error-kind-inference';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface LastTestInfo {
  ok: boolean | null;
  tested_at: string | null;
  latency_ms?: number | null;
  message?: string | null;
  status?: number | null;
  error_kind?: ErrorKind | null;
  /** Timeout efetivo aplicado (apenas em falhas por timeout). */
  timeout_ms?: number | null;
}

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '';
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return '';
  const diff = Date.now() - ts;
  if (diff < 5_000) return 'agora há pouco';
  if (diff < 60_000) return `há ${Math.round(diff / 1000)}s`;
  if (diff < 3_600_000) return `há ${Math.round(diff / 60_000)}min`;
  if (diff < 86_400_000) return `há ${Math.round(diff / 3_600_000)}h`;
  return `há ${Math.round(diff / 86_400_000)}d`;
}

export function LastTestLine({
  info,
  className,
  action,
  onClick,
  autoFocusOnFailure = false,
}: {
  info: LastTestInfo | null;
  className?: string;
  action?: ReactNode;
  onClick?: () => void;
  /**
   * Quando `true`, move o foco do teclado para esta linha sempre que uma
   * NOVA falha for registrada (mudança de `tested_at` com `ok === false`).
   * Ajuda o usuário com leitor de tela / teclado a localizar o status e o
   * botão "Testar novamente" sem precisar caçar a região na página.
   */
  autoFocusOnFailure?: boolean;
}) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const regionRef = useRef<HTMLDivElement | null>(null);
  const lastFailureKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!autoFocusOnFailure) return;
    if (info?.ok !== false || !info?.tested_at) return;
    const key = `${info.tested_at}:${info.status ?? ''}:${info.message ?? ''}`;
    if (lastFailureKeyRef.current === key) return;
    lastFailureKeyRef.current = key;
    // Foca o elemento clicável (botão) quando disponível; caso contrário,
    // foca a região (que recebe tabindex=-1) para que leitores de tela
    // anunciem a falha imediatamente.
    const target = buttonRef.current ?? regionRef.current;
    if (target) {
      // requestAnimationFrame garante que o nó já está montado/visível.
      requestAnimationFrame(() => target.focus({ preventScroll: false }));
    }
  }, [autoFocusOnFailure, info]);

  const wrap = (content: ReactNode) =>
    action ? (
      <div className={cn('flex min-h-7 items-start justify-between gap-2', className)}>
        <div className="min-w-0 flex-1">{content}</div>
        <div className="shrink-0 pt-0.5">{action}</div>
      </div>
    ) : (
      content
    );

  if (!info?.tested_at) {
    return wrap(
      <p
        className={cn(
          'inline-flex items-center gap-1.5 text-xs text-muted-foreground',
          !action && className,
        )}
      >
        <Clock className="h-3.5 w-3.5" /> Nunca verificado
      </p>,
    );
  }
  const Icon = info.ok ? CheckCircle2 : XCircle;
  const color = info.ok ? 'text-green-700 dark:text-green-400' : 'text-destructive';
  const rel = formatRelative(info.tested_at);
  const latency = info.latency_ms !== null ? `${info.latency_ms}ms` : null;
  const httpInfo = info.status ? `HTTP ${info.status}` : null;
  const successTail = info.ok ? [latency, httpInfo].filter(Boolean).join(' · ') : '';
  const isClickable = !!onClick;
  // Para falhas, derivamos copy semântica via error_kind (SSOT). O texto cru
  // do erro (info.message) vai para a linha técnica (3ª linha) e tooltip.
  // Fallback: registros antigos sem error_kind recebem inferência heurística.
  const resolvedKind: ErrorKind | null = !info.ok
    ? inferErrorKind({
        errorKind: info.error_kind ?? null,
        errorMessage: info.message ?? null,
        statusCode: info.status ?? null,
        success: info.ok,
      })
    : null;
  const errorCopy = !info.ok
    ? getErrorCopy(resolvedKind, info.status, info.message, info.timeout_ms)
    : null;
  const technicalDetail = !info.ok
    ? [
        httpInfo,
        resolvedKind === 'timeout' && info.timeout_ms ? `timeout ${info.timeout_ms}ms` : null,
        info.message?.trim(),
      ]
        .filter(Boolean)
        .join(' · ')
    : '';
  // Header line: status + when. Always single line, never truncates the timestamp.
  const headerText = (
    <>
      {info.ok ? 'Verificado' : (errorCopy?.title ?? 'Falhou')} · {rel}
      {info.ok && successTail ? ` — ${successTail}` : ''}
    </>
  );
  const headerNode = (
    <span
      className="inline-flex max-w-full items-center gap-1.5"
      title={!info.ok ? technicalDetail || undefined : undefined}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span
        className={cn('truncate', isClickable && 'underline decoration-dotted underline-offset-2')}
      >
        {headerText}
      </span>
    </span>
  );
  // Para falhas, renderizamos hint acionável (linha 2) + detalhe técnico (linha 3)
  const body = errorCopy ? (
    <span className="block">
      {headerNode}
      <span className="mt-0.5 block break-words text-[11px] leading-snug text-destructive/80">
        {errorCopy.hint}
      </span>
      {technicalDetail && technicalDetail !== errorCopy.hint && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className="mt-0.5 line-clamp-2 block cursor-help break-words font-mono text-[10px] leading-snug text-muted-foreground"
              aria-label="Detalhe técnico do erro — passe o mouse para ver completo"
            >
              {technicalDetail}
            </span>
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            align="start"
            className="max-w-md break-words font-mono text-[11px]"
          >
            {technicalDetail}
          </TooltipContent>
        </Tooltip>
      )}
    </span>
  ) : (
    headerNode
  );
  const ariaLive = info.ok === false ? 'assertive' : 'polite';
  if (isClickable) {
    return wrap(
      <button
        ref={buttonRef}
        type="button"
        onClick={onClick}
        aria-label={
          info.ok === false
            ? 'Falha no último teste — ver detalhes'
            : 'Ver detalhes do último teste'
        }
        title="Ver detalhes do último teste"
        aria-live={ariaLive}
        className={cn(
          '-mx-1 inline-block w-full max-w-full cursor-pointer rounded px-1 py-0.5 text-left text-xs transition-colors',
          info.ok
            ? 'hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40'
            : 'hover:bg-destructive/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40',
          color,
          !action && className,
        )}
      >
        {body}
      </button>,
    );
  }
  return wrap(
    <div
      ref={regionRef}
      tabIndex={-1}
      aria-live={ariaLive}
      className={cn(
        '-mx-1 max-w-full rounded px-1 text-xs focus-visible:outline-none focus-visible:ring-2',
        info.ok === false ? 'focus-visible:ring-destructive/40' : 'focus-visible:ring-ring/40',
        color,
        !action && className,
      )}
    >
      {body}
    </div>,
  );
}
