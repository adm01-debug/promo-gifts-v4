import { useCallback, useEffect, useRef, useState } from 'react';
import { DatabaseZap, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useSecretsManager } from '@/hooks/admin';
import { toast } from 'sonner';

const SKIP_CONFIRM_KEY = 'connections.global_refresh.skip_confirm';

interface GlobalRefreshFromDbButtonProps {
  /** Callback executed in parallel with cache invalidation + secret list refresh. */
  onRefreshed?: () => Promise<void> | void;
  cooldownMs?: number;
  /** Enable `R` keyboard shortcut (default: true). */
  enableShortcut?: boolean;
}

export function GlobalRefreshFromDbButton({
  onRefreshed,
  cooldownMs = 5000,
  enableShortcut = true,
}: GlobalRefreshFromDbButtonProps) {
  const { refreshCache, list } = useSecretsManager();
  const [isRunning, setIsRunning] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [dontAskAgain, setDontAskAgain] = useState(false);
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

  const runRefresh = useCallback(async () => {
    if (isRunning || inCooldown) return;
    setIsRunning(true);
    const startedAt = Date.now();
    try {
      const [cacheRes, listRes, hookRes] = await Promise.allSettled([
        refreshCache(),
        list(),
        Promise.resolve().then(() => onRefreshed?.()),
      ]);
      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);

      const cacheOk = cacheRes.status === 'fulfilled' && cacheRes.value.ok;
      const listOk = listRes.status === 'fulfilled';
      const hookOk = hookRes.status === 'fulfilled';

      const credCount = listOk && Array.isArray(listRes.value) ? listRes.value.length : 0;

      const okCount = [cacheOk, listOk, hookOk].filter(Boolean).length;

      if (okCount === 3) {
        toast.success('Tudo atualizado do banco', {
          description: `Cache invalidado · ${credCount} credenciais relidas · status das conexões recarregado (${elapsed}s)`,
        });
      } else if (okCount === 0) {
        toast.error('Falha ao atualizar do banco', {
          description: 'Nenhuma das operações concluiu com sucesso.',
        });
      } else {
        const failed: string[] = [];
        if (!cacheOk) failed.push('cache');
        if (!listOk) failed.push('credenciais');
        if (!hookOk) failed.push('status');
        toast.warning('Atualização parcial', {
          description: `Falhou: ${failed.join(', ')} (${elapsed}s)`,
        });
      }
    } finally {
      setIsRunning(false);
      setCooldownUntil(Date.now() + cooldownMs);
      setNow(Date.now());
    }
  }, [isRunning, inCooldown, refreshCache, list, onRefreshed, cooldownMs]);

  const requestConfirm = useCallback(() => {
    if (isRunning || inCooldown) return;
    let skip = false;
    try {
      skip = window.localStorage.getItem(SKIP_CONFIRM_KEY) === '1';
    } catch {
      /* noop */
    }
    if (skip) {
      void runRefresh();
      return;
    }
    setDontAskAgain(false);
    setConfirmOpen(true);
  }, [isRunning, inCooldown, runRefresh]);

  const handleConfirm = useCallback(() => {
    if (dontAskAgain) {
      try {
        window.localStorage.setItem(SKIP_CONFIRM_KEY, '1');
      } catch {
        /* noop */
      }
    }
    setConfirmOpen(false);
    void runRefresh();
  }, [dontAskAgain, runRefresh]);

  // Keyboard shortcut: R (no modifiers, not in input/textarea/contenteditable)
  useEffect(() => {
    if (!enableShortcut) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'r' && e.key !== 'R') return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const tag = t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable) return;
      e.preventDefault();
      requestConfirm();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enableShortcut, requestConfirm]);

  const isDisabled = isRunning || inCooldown;
  const ariaLabel = isRunning
    ? 'Atualizando…'
    : inCooldown
      ? `Aguarde ${secondsLeft}s antes de atualizar novamente`
      : 'Atualizar tudo do banco (atalho: R)';

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={requestConfirm}
              disabled={isDisabled}
              aria-label={ariaLabel}
            >
              {isRunning ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <DatabaseZap className="mr-1 h-4 w-4" />
              )}
              {isRunning
                ? 'Atualizando…'
                : inCooldown
                  ? `Aguarde ${secondsLeft}s`
                  : 'Atualizar tudo do banco'}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="max-w-[260px] text-xs">
              Invalida o cache de 60s das credenciais, relê o banco e recarrega o status de todas as
              conexões. Atalho: <kbd className="rounded bg-muted px-1">R</kbd>
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Atualizar tudo do banco?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Esta ação vai:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>
                    Invalidar o cache de 60s de <strong>todas</strong> as credenciais
                  </li>
                  <li>Reler o status de todas as credenciais do banco</li>
                  <li>Recarregar o status persistido de todas as conexões</li>
                </ul>
                <p>
                  Próximas chamadas a integrações vão pagar uma releitura do banco até o cache
                  reaquecer. Use quando acabou de editar credenciais ou suspeita de valor
                  desatualizado.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center gap-2 pt-1">
            <Checkbox
              id="global-refresh-skip-confirm"
              checked={dontAskAgain}
              onCheckedChange={(v) => setDontAskAgain(v === true)}
            />
            <Label
              htmlFor="global-refresh-skip-confirm"
              className="cursor-pointer text-xs font-normal"
            >
              Não perguntar novamente neste navegador
            </Label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              <DatabaseZap className="mr-1 h-4 w-4" />
              Atualizar agora
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
