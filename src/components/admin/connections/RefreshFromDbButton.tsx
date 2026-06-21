import { useCallback, useEffect, useRef, useState } from 'react';
import { DatabaseZap, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSecretsManager } from '@/hooks/admin';
import { toast } from 'sonner';

interface RefreshFromDbButtonProps {
  /** Optional: invalidate cache for a single secret. Omit for all. */
  secretName?: string;
  /** Called after a successful refresh (e.g. to re-`list()` secrets). */
  onRefreshed?: () => Promise<void> | void;
  cooldownMs?: number;
  label?: string;
}

export function RefreshFromDbButton({
  secretName,
  onRefreshed,
  cooldownMs = 5000,
  label = 'Atualizar do banco',
}: RefreshFromDbButtonProps) {
  const { refreshCache } = useSecretsManager();
  const [isRunning, setIsRunning] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const inCooldown = cooldownUntil > now;
  const secondsLeft = inCooldown ? Math.max(1, Math.ceil((cooldownUntil - now) / 1000)) : 0;

  useEffect(() => {
    if (!inCooldown) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    if (intervalRef.current) return;
    intervalRef.current = setInterval(() => setNow(Date.now()), 250);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [inCooldown]);

  useEffect(
    () => () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    },
    [],
  );

  const handleClick = useCallback(async () => {
    if (isRunning || inCooldown) return;
    setIsRunning(true);
    try {
      const r = await refreshCache(secretName);
      if (r.ok) {
        toast.success('Cache invalidado', {
          description: 'Próximas chamadas relerão os valores do banco.',
        });
        await onRefreshed?.();
      } else {
        toast.error('Falha ao atualizar cache', {
          description: 'Não foi possível atualizar o cache.',
        });
      }
    } finally {
      setIsRunning(false);
      setCooldownUntil(Date.now() + cooldownMs);
      setNow(Date.now());
    }
  }, [isRunning, inCooldown, refreshCache, secretName, onRefreshed, cooldownMs]);

  const isDisabled = isRunning || inCooldown;
  const title = isRunning
    ? 'Atualizando…'
    : inCooldown
      ? `Aguarde ${secondsLeft}s antes de atualizar novamente`
      : 'Invalida o cache de 60s das credenciais e força releitura do banco';

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={handleClick}
      disabled={isDisabled}
      title={title}
      aria-label={title}
    >
      {isRunning ? (
        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
      ) : (
        <DatabaseZap className="mr-1 h-4 w-4" />
      )}
      {isRunning ? 'Atualizando…' : inCooldown ? `Aguarde ${secondsLeft}s` : label}
    </Button>
  );
}
