import { AlertTriangle, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { diagnoseMaskedSuffix, formatDisplaySuffix } from '@/lib/masked-suffix';

interface Props {
  /** Sufixo cru retornado pelo backend (pode ser null, curto ou completo). */
  suffix: string | null | undefined;
  /** Nome do secret — usado para personalizar a mensagem de orientação. */
  secretName?: string;
  /**
   * Comprimento total da credencial (quando conhecido). Usado como fallback
   * para gerar um sufixo derivado (`L=NN`) quando `suffix` está ausente,
   * preservando o layout sem expor dados.
   */
  length?: number | null;
  /** Quando true, mostra o badge mesmo no estado válido (default: false). */
  showWhenValid?: boolean;
  /** Mostra o sufixo formatado ao lado do ícone (default: true). */
  showSuffix?: boolean;
  /** Tooltip nativo (title) opcional — ex.: "atualizado em/por". */
  tooltip?: string;
  className?: string;
}

/**
 * Renderiza o sufixo mascarado com um indicador visual de saúde:
 * - válido (4+ chars): nenhum aviso (a menos que showWhenValid)
 * - curto (<4 chars): chip âmbar com tooltip explicativo
 * - ausente: chip destrutivo com tooltip + sufixo derivado (`L=NN`)
 *
 * Sempre acessível: o tooltip vira `aria-description` para leitores de tela.
 * Layout estável: sempre renderiza 8 chars (`••••XXXX`) no slot do sufixo,
 * mesmo no fallback.
 */
export function MaskedSuffixBadge({
  suffix,
  secretName,
  length,
  showWhenValid = false,
  showSuffix = true,
  tooltip,
  className,
}: Props) {
  const diagnosis = diagnoseMaskedSuffix(suffix, { secretName });
  // Sempre usa o resolvedor com fallback derivado — garante layout estável
  // mesmo quando o sufixo cru é nulo/curto.
  const display = formatDisplaySuffix(suffix, { length });
  const isFallback = diagnosis.status !== 'valid' && (suffix ?? '').trim() === '';

  if (diagnosis.status === 'valid' && !showWhenValid) {
    return showSuffix ? (
      <span
        className={cn('font-mono text-xs tabular-nums text-muted-foreground', className)}
        aria-label={diagnosis.message}
        title={tooltip}
      >
        {display}
      </span>
    ) : null;
  }

  const tone =
    diagnosis.status === 'missing'
      ? {
          icon: ShieldAlert,
          chip: 'bg-destructive/10 border-destructive/40 text-destructive',
          ring: 'ring-destructive/30',
        }
      : diagnosis.status === 'short'
        ? {
            icon: AlertTriangle,
            chip: 'bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-300',
            ring: 'ring-amber-500/30',
          }
        : {
            icon: CheckCircle2,
            chip: 'bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
            ring: 'ring-emerald-500/30',
          };

  const Icon = tone.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="status"
          aria-live="polite"
          aria-label={diagnosis.message}
          className={cn(
            'inline-flex cursor-help items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium ring-1',
            tone.chip,
            tone.ring,
            className,
          )}
        >
          <Icon className="h-3 w-3 shrink-0" aria-hidden />
          {showSuffix && <span className="font-mono tabular-nums">{display}</span>}
          {isFallback && (
            <span className="text-[9px] uppercase tracking-wider opacity-80" aria-hidden>
              fallback
            </span>
          )}
          <span className="hidden sm:inline">— {diagnosis.label}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" align="start" className="leading-relaxed">
        <p className="mb-1 font-medium">{diagnosis.label}</p>
        <p className="text-muted-foreground">{diagnosis.message}</p>
        {isFallback && length !== null && length !== undefined && length > 0 && (
          <p className="mt-2 border-t border-border/50 pt-2 text-[11px] text-muted-foreground">
            Exibindo placeholder derivado <span className="font-mono">{display}</span> (comprimento
            total: {length} chars) até que o sufixo real seja regenerado.
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
