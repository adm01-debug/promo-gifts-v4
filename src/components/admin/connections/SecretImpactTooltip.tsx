/**
 * SecretImpactTooltip
 *
 * Envolve o label/nome de um secret com um tooltip que descreve as telas
 * e fluxos do produto que **deixam de funcionar** quando o valor está
 * ausente ou vazio.
 *
 * Visual:
 *   - Quando `severity` está "alta" (status ausente/vazio), o cursor vira
 *     `help` e um pequeno indicador `Info` aparece ao lado para chamar a
 *     atenção do admin antes de deletar/rotacionar.
 *   - Quando o secret está populado, o tooltip continua disponível em hover
 *     (informacional) sem o badge de alerta.
 */
import { Info, AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { getSecretImpact, type SecretImpact } from './secretImpactMap';

interface Props {
  /** Nome canônico do secret (ex.: EXTERNAL_PROMOBRIND_URL). */
  secretName: string;
  /** Conteúdo a ser envolvido (geralmente o `<Label>` ou o nome). */
  children: React.ReactNode;
  /**
   * Indica se o valor está ausente/vazio agora — quando true, eleva
   * a visibilidade (ícone de alerta + cursor:help).
   */
  isMissing?: boolean;
  className?: string;
}

const SEVERITY_TONE: Record<SecretImpact['severity'], string> = {
  critical: 'text-destructive',
  high: 'text-destructive',
  medium: 'text-warning',
  low: 'text-muted-foreground',
};

const SEVERITY_LABEL: Record<SecretImpact['severity'], string> = {
  critical: 'Crítico',
  high: 'Alto',
  medium: 'Médio',
  low: 'Baixo',
};

export function SecretImpactTooltip({ secretName, children, isMissing, className }: Props) {
  const impact = getSecretImpact(secretName);

  // Sem mapeamento: ainda renderiza o trigger mas com mensagem genérica.
  const content = impact ? (
    <div className="max-w-sm space-y-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold">{impact.system}</p>
        <span
          className={cn(
            'rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase',
            impact.severity === 'critical' || impact.severity === 'high'
              ? 'border-destructive/40 bg-destructive/10 text-destructive'
              : impact.severity === 'medium'
                ? 'border-warning/40 bg-warning/10 text-warning'
                : 'border-border bg-muted text-muted-foreground',
          )}
        >
          {SEVERITY_LABEL[impact.severity]}
        </span>
      </div>

      <p className="text-muted-foreground">
        Se esta chave estiver{' '}
        <strong className={SEVERITY_TONE[impact.severity]}>ausente ou vazia</strong>, os itens
        abaixo deixam de funcionar:
      </p>

      <div>
        <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          Telas afetadas
        </p>
        <ul className="space-y-0.5">
          {impact.screens.map((s) => (
            <li key={s} className="font-mono text-[11px]">
              • {s}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          Fluxos afetados
        </p>
        <ul className="space-y-0.5">
          {impact.flows.map((f) => (
            <li key={f} className="text-[11px]">
              • {f}
            </li>
          ))}
        </ul>
      </div>
    </div>
  ) : (
    <p className="max-w-xs text-xs">
      Sem mapeamento de impacto para <code className="font-mono">{secretName}</code>. Mantenha-a
      populada se for usada por alguma edge function.
    </p>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            className={cn(
              'inline-flex cursor-help items-center gap-1 rounded focus:outline-none focus:ring-2 focus:ring-ring',
              className,
            )}
            aria-label={
              impact
                ? `Impacto de ${secretName}: ${impact.system} (${SEVERITY_LABEL[impact.severity]})`
                : `Impacto de ${secretName}: sem mapeamento`
            }
          >
            {children}
            {isMissing && impact ? (
              <AlertTriangle
                className={cn('h-3 w-3', SEVERITY_TONE[impact.severity])}
                aria-hidden="true"
              />
            ) : (
              <Info className="h-3 w-3 text-muted-foreground/60" aria-hidden="true" />
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-sm">
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
