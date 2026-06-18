import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useRetestCooldownSetting } from '@/hooks/admin';

interface RetestButtonProps {
  onRetest: () => Promise<void> | void;
  disabled?: boolean;
  cooldownMs?: number;
  disabledReason?: string;
  /** Stable identifier (e.g. connection type/id) used to persist the cooldown
   *  across remounts in the same tab. Falls back to in-memory only when omitted. */
  cooldownKey?: string;
  /** Keyboard key (lowercase) that fires the retest when an ancestor element
   *  with [data-retest-scope] contains the focus. Default: "r". Pass null to
   *  disable. Ignored when typing inside inputs/textareas/contenteditable. */
  shortcutKey?: string | null;
  /** Hard timeout (ms) after which the running state is cleared even if the
   *  underlying tester promise hasn't resolved — prevents a stuck "Testando…"
   *  state when the endpoint hangs. Default: 30000 (30s). Pass 0 to disable. */
  timeoutMs?: number;
}

type DisabledKind = 'running' | 'cooldown' | 'credentials' | null;

const STORAGE_PREFIX = 'retest:cooldown:';

function readPersistedCooldown(key: string | undefined): number {
  if (!key || typeof window === 'undefined') return 0;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return 0;
    const parsed = parseInt(raw, 10);
    if (!Number.isFinite(parsed)) return 0;
    // Drop stale (already expired) entries.
    if (parsed <= Date.now()) {
      window.sessionStorage.removeItem(STORAGE_PREFIX + key);
      return 0;
    }
    return parsed;
  } catch {
    return 0;
  }
}

function writePersistedCooldown(key: string | undefined, until: number): void {
  if (!key || typeof window === 'undefined') return;
  try {
    if (until <= Date.now()) {
      window.sessionStorage.removeItem(STORAGE_PREFIX + key);
    } else {
      window.sessionStorage.setItem(STORAGE_PREFIX + key, String(until));
    }
  } catch {
    /* sessionStorage may be unavailable (private mode) — fall back to memory only. */
  }
}

export function RetestButton({
  onRetest,
  disabled = false,
  cooldownMs,
  disabledReason,
  cooldownKey,
  shortcutKey = 'r',
  timeoutMs = 30_000,
}: RetestButtonProps) {
  // Global admin-controlled cooldown; explicit prop wins when provided.
  const { cooldownMs: globalCooldownMs } = useRetestCooldownSetting();
  const effectiveCooldownMs = cooldownMs ?? globalCooldownMs;
  const [isRunning, setIsRunning] = useState(false);
  // Lazy init from sessionStorage so cooldown survives a remount.
  const [cooldownUntil, setCooldownUntil] = useState<number>(() =>
    readPersistedCooldown(cooldownKey),
  );
  const [now, setNow] = useState<number>(() => Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wrapperRef = useRef<HTMLSpanElement | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timedOutRef = useRef(false);

  const inCooldown = cooldownUntil > now;
  const secondsLeft = inCooldown ? Math.max(1, Math.ceil((cooldownUntil - now) / 1000)) : 0;

  // Re-sync from storage if key changes mid-life (rare, but safe).
  useEffect(() => {
    const persisted = readPersistedCooldown(cooldownKey);
    if (persisted > 0) {
      setCooldownUntil((prev) => (persisted > prev ? persisted : prev));
      setNow(Date.now());
    }
  }, [cooldownKey]);

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

  // Clear any pending watchdog on unmount.
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleClick = useCallback(async () => {
    // Re-check persisted cooldown right before firing — guards against rapid
    // double-clicks across remounts within the debounce window.
    const persisted = readPersistedCooldown(cooldownKey);
    if (persisted > Date.now()) {
      setCooldownUntil(persisted);
      setNow(Date.now());
      return;
    }
    if (isRunning || inCooldown || disabled) return;

    setIsRunning(true);
    timedOutRef.current = false;

    // Watchdog: race onRetest against a hard timeout so the button never gets
    // stuck on "Testando…" when the upstream tester (or edge function) hangs.
    const watchdog =
      timeoutMs > 0
        ? new Promise<'__retest_timeout__'>((resolve) => {
            timeoutRef.current = setTimeout(() => {
              timedOutRef.current = true;
              resolve('__retest_timeout__');
            }, timeoutMs);
          })
        : null;

    try {
      const result = watchdog
        ? await Promise.race([
            Promise.resolve(onRetest()).then(() => '__retest_done__' as const),
            watchdog,
          ])
        : await onRetest();
      if (result === '__retest_timeout__') {
        toast.error('Tempo esgotado', {
          description: `O teste não respondeu em ${Math.round(timeoutMs / 1000)}s. O servidor pode estar fora do ar — tente novamente em instantes.`,
        });
      }
    } catch {
      // Errors are handled & toasted inside the tester hook; swallow here so
      // the finally block always restores the UI.
    } finally {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setIsRunning(false);
      const until = Date.now() + effectiveCooldownMs;
      setCooldownUntil(until);
      setNow(Date.now());
      writePersistedCooldown(cooldownKey, until);
    }
  }, [isRunning, inCooldown, disabled, onRetest, effectiveCooldownMs, cooldownKey, timeoutMs]);

  // Cleanup persisted entry once the cooldown naturally expires.
  useEffect(() => {
    if (!cooldownKey || cooldownUntil === 0) return;
    if (cooldownUntil <= now) {
      writePersistedCooldown(cooldownKey, 0);
    }
  }, [cooldownKey, cooldownUntil, now]);

  // Keyboard shortcut: fire onRetest when an ancestor [data-retest-scope]
  // contains the current focus and the user presses `shortcutKey`.
  // Respects the same debounce/disabled rules as the button click.
  useEffect(() => {
    if (!shortcutKey) return;
    const target = shortcutKey.toLowerCase();
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat) return;
      if (e.key.toLowerCase() !== target) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Don't hijack typing inside form fields / contenteditable.
      const active = document.activeElement as HTMLElement | null;
      if (active) {
        const tag = active.tagName;
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
        if (active.isContentEditable) return;
      }
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const scope = wrapper.closest<HTMLElement>('[data-retest-scope]');
      if (!scope) return;
      // Only fire if focus is inside this scope (or scope itself is focused).
      if (!scope.contains(active) && active !== scope) return;
      e.preventDefault();
      handleClick();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [shortcutKey, handleClick]);

  const disabledKind: DisabledKind = isRunning
    ? 'running'
    : disabled
      ? 'credentials'
      : inCooldown
        ? 'cooldown'
        : null;

  const tooltip = (() => {
    switch (disabledKind) {
      case 'running':
        return {
          title: 'Teste em andamento',
          body: 'Aguarde a resposta do serviço antes de disparar novamente.',
        };
      case 'credentials':
        return {
          title: 'Credenciais inválidas ou ausentes',
          body: disabledReason ?? 'Preencha e salve as credenciais obrigatórias antes de testar.',
        };
      case 'cooldown':
        return {
          title: `Aguarde ${secondsLeft}s (debounce)`,
          body: 'Pequena pausa entre testes para evitar disparos acidentais e respeitar limites do serviço externo.',
        };
      default:
        return {
          title: 'Disparar novo teste',
          body: 'Executa imediatamente um teste manual e grava no histórico.',
        };
    }
  })();

  const label = isRunning
    ? 'Testando…'
    : inCooldown
      ? `Aguarde ${secondsLeft}s`
      : 'Testar novamente';

  const isDisabled = disabledKind !== null;

  const button = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 gap-1.5 px-2 text-xs"
      disabled={isDisabled}
      onClick={handleClick}
      aria-label={tooltip.title}
    >
      <RefreshCw className={cn('h-3.5 w-3.5', isRunning && 'animate-spin')} />
      {label}
    </Button>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span ref={wrapperRef} className="inline-flex">
            {button}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="leading-snug">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium">{tooltip.title}</p>
            {shortcutKey && !isDisabled ? (
              <kbd className="ml-2 inline-flex h-4 min-w-4 items-center justify-center rounded border bg-muted px-1 font-mono text-[10px] uppercase text-muted-foreground">
                {shortcutKey}
              </kbd>
            ) : null}
          </div>
          <p className="mt-0.5 text-muted-foreground">{tooltip.body}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
