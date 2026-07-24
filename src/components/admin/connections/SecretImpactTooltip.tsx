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
    <div className="max-w-sm space-y-3">
      <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-2">
        <p className="font-bold leading-tight">{impact.system}</p>
        <span
          className={cn(
            'text-tooltip-header rounded px-1 py-0.5 font-mono !opacity-100',
            impact.severity === 'critical' || impact.severity === 'high'
              ? 'bg-destructive/20 text-destructive'
              : impact.severity === 'medium'
                ? 'bg-warning/20 text-warning'
                : 'bg-white/10 text-white/60',
          )}
        >
          {SEVERITY_LABEL[impact.severity]}
        </span>
      </div>

      <p className="text-tooltip leading-relaxed text-white/70">
        Se esta chave estiver{' '}
        <strong className={cn('font-bold', SEVERITY_TONE[impact.severity])}>
          ausente ou vazia
        </strong>
        , os itens abaixo deixam de funcionar:
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-tooltip-header mb-1">Telas Afetadas</p>
          <ul className="space-y-0.5">
            {impact.screens.map((s) => (
              <li key={s} className="text-tooltip flex items-center gap-1 font-mono text-white/80">
                <span className="h-0.5 w-0.5 rounded-full bg-white/20" />
                {s}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-tooltip-header mb-1">Fluxos Afetados</p>
          <ul className="space-y-0.5">
            {impact.flows.map((f) => (
              <li key={f} className="text-tooltip flex items-center gap-1 text-white/80">
                <span className="h-0.5 w-0.5 rounded-full bg-white/20" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  ) : (
    <div className="max-w-xs space-y-1">
      <p className="text-tooltip-header">Aviso de Configuração</p>
      <p className="leading-relaxed text-white/70">
        Sem mapeamento de impacto para <code className="font-mono text-primary">{secretName}</code>.
        Mantenha-a populada se for usada por alguma edge function.
      </p>
    </div>
  );

  return (
    <TooltipProvider>
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
                className={cn('h-4 w-4', SEVERITY_TONE[impact.severity])}
                aria-hidden="true"
              />
            ) : (
              <Info className="h-4 w-4 text-muted-foreground/60" aria-hidden="true" />
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">{content}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
