import { Timer } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { RETEST_COOLDOWN_PRESETS_MS, useRetestCooldownSetting } from '@/hooks/admin';

interface Props {
  className?: string;
}

/**
 * Inline selector rendered next to "Testar novamente" so admins can adjust the
 * global debounce between manual connection tests. Persists to `admin_settings`
 * via {@link useRetestCooldownSetting}; updates propagate to every mounted
 * RetestButton instantly via the shared module-level cache.
 */
export function RetestCooldownSelector({ className }: Props) {
  const { cooldownMs, loading, saving, save } = useRetestCooldownSetting();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('inline-flex items-center gap-1.5', className)}>
            <Timer className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            <Select
              value={String(cooldownMs)}
              disabled={loading || saving}
              onValueChange={(v) => {
                const ms = parseInt(v, 10);
                if (Number.isFinite(ms) && ms > 0) void save(ms);
              }}
            >
              <SelectTrigger
                className="h-7 w-[88px] px-2 text-xs"
                aria-label="Cooldown entre testes manuais"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RETEST_COOLDOWN_PRESETS_MS.map((ms) => (
                  <SelectItem key={ms} value={String(ms)} className="text-xs">
                    {ms / 1000}s
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="leading-snug">
          <p className="font-medium">Cooldown entre testes manuais</p>
          <p className="mt-0.5 text-muted-foreground">
            Tempo mínimo de espera após disparar "Testar novamente". Vale para todos os admins
            (configuração global).
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
