import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatMaskedSuffix } from '@/lib/masked-suffix';

interface Props {
  maskedSuffix: string | null;
  length: number;
  action: 'rotate' | 'set';
  wasUpdate?: boolean;
  /** ms before the flash auto-hides */
  duration?: number;
  /** When true, append "agora vem do banco" to indicate env→db migration. */
  wasEnvFallback?: boolean;
}

export function JustSavedFlash({
  maskedSuffix,
  length,
  action,
  wasUpdate,
  duration = 2400,
  wasEnvFallback,
}: Props) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), duration);
    return () => clearTimeout(t);
  }, [duration]);

  if (!visible) return null;

  const verb = action === 'rotate' ? 'Rotacionado' : wasUpdate ? 'Atualizado' : 'Salvo';
  const suffixText = formatMaskedSuffix(maskedSuffix);

  return (
    <p
      className={cn(
        'inline-flex items-center gap-1.5 text-xs text-green-700 duration-300 animate-in fade-in slide-in-from-top-1 dark:text-green-400',
      )}
      role="status"
      aria-live="polite"
    >
      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
      <span>
        {verb} • {suffixText} • {length} chars •{' '}
        {wasEnvFallback ? 'agora vem do banco' : 'atualizado agora'}
      </span>
    </p>
  );
}
