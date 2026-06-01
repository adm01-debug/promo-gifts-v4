import { ArrowRight, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Defense-in-depth: never render more than 4 trailing characters of any
 * secret value. Even if a parent passed the full plaintext by mistake, this
 * component would still mask it.
 */
function safeSuffix(raw: string | null | undefined): string {
  if (!raw) return '????';
  const last4 = raw.slice(-4);
  return last4.length === 4 ? last4 : last4.padStart(4, '•');
}

interface Props {
  currentSuffix: string | null;
  currentLength: number | null;
  newSuffix: string;
  newLength: number;
  /** When true, omit the "current" side and show only the new value */
  newOnly?: boolean;
  className?: string;
}

export function SecretMaskedDiff({
  currentSuffix,
  currentLength,
  newSuffix,
  newLength,
  newOnly,
  className,
}: Props) {
  const cur = safeSuffix(currentSuffix);
  const next = safeSuffix(newSuffix);

  return (
    <div
      className={cn('space-y-2 rounded-lg border border-border bg-muted/50 p-4', className)}
      role="group"
      aria-label="Pré-visualização mascarada do valor da credencial"
    >
      {newOnly ? (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">Novo valor:</span>
          <span className="font-mono font-medium">
            ••••{next}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              ({newLength} {newLength === 1 ? 'char' : 'chars'})
            </span>
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-x-3 gap-y-2 text-sm">
          <span className="text-muted-foreground">Valor atual:</span>
          <span className="font-mono">
            ••••{cur}
            <span className="ml-2 text-xs text-muted-foreground">({currentLength ?? 0} chars)</span>
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="font-mono font-medium">
            ••••{next}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              ({newLength} {newLength === 1 ? 'char' : 'chars'})
            </span>
          </span>
        </div>
      )}
      <p className="flex items-center gap-1.5 border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
        <Lock className="h-3 w-3" aria-hidden="true" />
        Apenas os 4 últimos caracteres são exibidos. O valor completo nunca é mostrado nem
        registrado em logs.
      </p>
    </div>
  );
}
