/**
 * <EdgeFallback /> — estado consistente de fallback para telas que dependem
 * de edge functions (visual-search, connection-tester, dropbox-list, etc).
 *
 * Casos cobertos: `disconnected`, `error`, `empty`, `loading` (skeleton simples).
 * Mensagens passam por `<SafeMessage />` (sanitize-message SSOT), então nunca
 * vazam stack/UPPER_SNAKE/`Error:` para o usuário final.
 *
 * Uso:
 *   <EdgeFallback variant="error" error={err} tip="Tente novamente em instantes."
 *                 onRetry={refetch} />
 *   <EdgeFallback variant="disconnected" title="Dropbox não conectado"
 *                 description="Configure a integração para navegar arquivos." />
 *   <EdgeFallback variant="empty" title="Nenhum arquivo encontrado" />
 */
import { type ReactElement, type ReactNode } from 'react';
import { AlertTriangle, CloudOff, Inbox, Loader2, RefreshCw, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SafeMessage } from '@/components/errors/SafeMessage';
import { cn } from '@/lib/utils';

export type EdgeFallbackVariant = 'disconnected' | 'empty' | 'error' | 'loading';

export interface EdgeFallbackProps {
  variant: EdgeFallbackVariant;
  /** Título curto (H2). Default varia por variant. */
  title?: string;
  /** Descrição estática (opcional). Ignorada quando `error` está presente. */
  description?: ReactNode;
  /** Erro cru — sanitizado via SafeMessage. */
  error?: unknown;
  /** Dica secundária (ex: "Verifique sua conexão"). */
  tip?: ReactNode;
  /** Callback opcional para o botão "Tentar novamente". */
  onRetry?: () => void;
  /** Texto do botão de retry. */
  retryLabel?: string;
  /** Ícone customizado. */
  icon?: LucideIcon;
  /** Loading state do retry (desabilita o botão). */
  isRetrying?: boolean;
  className?: string;
  'data-testid'?: string;
}

const DEFAULTS: Record<EdgeFallbackVariant, { icon: LucideIcon; title: string }> = {
  error: { icon: AlertTriangle, title: 'Não foi possível carregar os dados' },
  disconnected: { icon: CloudOff, title: 'Integração não conectada' },
  empty: { icon: Inbox, title: 'Nenhum resultado' },
  loading: { icon: Loader2, title: 'Carregando…' },
};

export function EdgeFallback({
  variant,
  title,
  description,
  error,
  tip,
  onRetry,
  retryLabel = 'Tentar novamente',
  icon,
  isRetrying = false,
  className,
  'data-testid': testId,
}: EdgeFallbackProps): ReactElement {
  const cfg = DEFAULTS[variant];
  const Icon = icon ?? cfg.icon;
  const resolvedTitle = title ?? cfg.title;
  const isLoading = variant === 'loading';

  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      aria-live={variant === 'error' ? 'assertive' : 'polite'}
      data-testid={testId ?? `edge-fallback-${variant}`}
      className={cn(
        'mx-auto flex min-h-[240px] w-full max-w-md flex-col items-center justify-center gap-3 rounded-2xl border border-border/50 bg-muted/20 p-6 text-center',
        variant === 'error' && 'border-destructive/30 bg-destructive/5',
        className,
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          'h-12 w-12 shrink-0',
          isLoading && 'animate-spin text-primary',
          variant === 'error' && 'text-destructive',
          variant === 'disconnected' && 'text-muted-foreground',
          variant === 'empty' && 'text-muted-foreground',
        )}
      />
      <h2 className="font-display text-lg font-semibold text-foreground">{resolvedTitle}</h2>
      {error !== null && error !== undefined ? (
        <SafeMessage
          error={error}
          className="max-w-sm text-sm text-muted-foreground"
          data-testid={testId ? `${testId}-message` : `edge-fallback-${variant}-message`}
        />
      ) : description ? (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {tip ? <p className="max-w-sm text-xs text-muted-foreground/80">{tip}</p> : null}
      {onRetry ? (
        <Button
          size="sm"
          variant={variant === 'error' ? 'destructive' : 'outline'}
          onClick={onRetry}
          disabled={isRetrying}
          className="mt-2"
          data-testid={testId ? `${testId}-retry` : `edge-fallback-${variant}-retry`}
        >
          {isRetrying ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          )}
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}

export default EdgeFallback;
