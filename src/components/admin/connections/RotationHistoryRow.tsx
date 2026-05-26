import { useEffect, useState } from 'react';
import { RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSecretsManager, type RotationHistoryEntry } from '@/hooks/admin';
import { RotationHistoryDialog } from './RotationHistoryDialog';
import { formatMaskedSuffix } from '@/lib/masked-suffix';

interface Props {
  secretName: string;
  /** Bump to force re-fetch (e.g. after a rotation) */
  refreshKey?: number;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return 'há instantes';
  const min = Math.floor(sec / 60);
  if (min < 60) return `há ${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `há ${hr}h`;
  const d = Math.floor(hr / 24);
  return `há ${d}d`;
}

export function RotationHistoryRow({ secretName, refreshKey = 0 }: Props) {
  const { getRotationHistory } = useSecretsManager();
  const [latest, setLatest] = useState<RotationHistoryEntry | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getRotationHistory(secretName).then((entries) => {
      if (cancelled) return;
      setLatest(entries[0] ?? null);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [secretName, refreshKey, getRotationHistory]);

  if (!loaded || !latest) return null;

  const author = latest.rotated_by_email ?? 'autor desconhecido';

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground duration-300 animate-in fade-in">
        <RotateCw className="h-3 w-3 shrink-0 text-primary" />
        <span>
          Última rotação{' '}
          <span className="font-medium text-foreground">{formatRelative(latest.rotated_at)}</span>
          {' • '}
          <span className="font-mono">
            {latest.previous_suffix ? formatMaskedSuffix(latest.previous_suffix) : '(env)'}
            {' → '}
            {formatMaskedSuffix(latest.new_suffix)}
          </span>
          {' • '}
          por <span className="font-medium">{author}</span>
        </span>
        <Button
          size="sm"
          variant="link-secondary"
          className="h-auto p-0 text-xs"
          onClick={() => setDialogOpen(true)}
        >
          Ver histórico completo
        </Button>
      </div>
      <RotationHistoryDialog
        secretName={secretName}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
