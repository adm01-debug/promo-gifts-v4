import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatMaskedSuffix } from '@/lib/masked-suffix';

interface Props {
  masked_suffix: string | null;
  length: number;
  action: 'set' | 'rotate';
  was_update?: boolean;
  /** ms before the flash auto-hides */
  duration?: number;
  /** When true, append "agora vem do banco" to indicate env→db migration. */
  was_env_fallback?: boolean;
}

export function JustSavedFlash({
  masked_suffix,
  length,
  action,
  was_update,
  duration = 2400,
  was_env_fallback,
}: Props) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), duration);
    return () => clearTimeout(t);
  }, [duration]);

  if (!visible) return null;

  const verb = action === 'rotate' ? 'Rotacionado' : was_update ? 'Atualizado' : 'Salvo';
  const suffixText = formatMaskedSuffix(masked_suffix);

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
        {was_env_fallback ? 'agora vem do banco' : 'atualizado agora'}
      </span>
    </p>
  );
}
