/**
 * HeaderSeveritySummary — Onda 14
 *
 * Resumo compacto de severidade no Page Header, ao lado do Refresh global.
 * Mostra três pílulas P0/P1/P2 com:
 *  - Contagem associada (P0 = conexões críticas, P1 = degradação, P2 = sinal verde)
 *  - Cor por severidade (destrutivo/aviso/sucesso)
 *  - Pílula da severidade global atual em destaque (anel + leve pulse em P0/P1)
 *  - Tooltip explicando o significado de cada nível e o que está sendo contado
 *
 * Fonte: usePulseBarStatus (mesma origem da Pulse Bar — sem fetches extras).
 */
import { AlertOctagon, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { usePulseBarStatus, type PulseSeverity } from './usePulseBarStatus';

type Tone = 'destructive' | 'success' | 'warning';

interface PillDef {
  level: PulseSeverity;
  icon: typeof AlertOctagon;
  label: string;
  meaning: string;
  counts: string;
  tone: Tone;
  count: number;
}

const TONE_CLASSES: Record<
  Tone,
  { bg: string; text: string; border: string; ring: string; pulse: string }
> = {
  destructive: {
    bg: 'bg-destructive/10',
    text: 'text-destructive',
    border: 'border-destructive/30',
    ring: 'ring-destructive/40',
    pulse: 'bg-destructive',
  },
  warning: {
    bg: 'bg-warning/10',
    text: 'text-warning',
    border: 'border-warning/30',
    ring: 'ring-warning/40',
    pulse: 'bg-warning',
  },
  success: {
    bg: 'bg-success/10',
    text: 'text-success',
    border: 'border-success/30',
    ring: 'ring-success/40',
    pulse: 'bg-success',
  },
};

export function HeaderSeveritySummary({ className }: { className?: string }) {
  const { data, isLoading } = usePulseBarStatus();

  // Contagens derivadas dos KPIs já calculados na Pulse Bar (sem fetch extra)
  const failingConnections = data?.kpis.failingConnections ?? 0;
  const autoDisabled = data?.kpis.autoDisabledWebhooks ?? 0;
  const staleSecrets = data?.kpis.staleSecrets ?? 0;
  const successRate = data?.kpis.successRate24h;

  // P0: conexões em falha + webhooks auto-disabled + 24h <70%
  const p0Count =
    failingConnections +
    autoDisabled +
    (successRate !== null && successRate !== undefined && successRate < 70 ? 1 : 0);
  // P1: secrets stale + 24h entre 70 e 95
  const p1Count =
    staleSecrets +
    (successRate !== null && successRate !== undefined && successRate >= 70 && successRate < 95
      ? 1
      : 0);
  // P2: estável quando não há P0 nem P1
  const p2Count = p0Count === 0 && p1Count === 0 ? 1 : 0;

  const current: PulseSeverity = data?.severity ?? 'P2';

  const pills: PillDef[] = [
    {
      level: 'P0',
      icon: AlertOctagon,
      label: 'P0',
      meaning: 'Crítico — impacto imediato no fluxo de integrações. Exige intervenção agora.',
      counts:
        'Conta: conexões com último teste falhando, webhooks pausados pelo circuit breaker e taxa de sucesso 24h < 70%.',
      tone: 'destructive',
      count: p0Count,
    },
    {
      level: 'P1',
      icon: AlertTriangle,
      label: 'P1',
      meaning: 'Atenção — degradação visível. Monitore de perto e planeje correção.',
      counts: 'Conta: credenciais sem rotação há >90 dias e taxa de sucesso 24h entre 70% e 95%.',
      tone: 'warning',
      count: p1Count,
    },
    {
      level: 'P2',
      icon: CheckCircle2,
      label: 'P2',
      meaning: 'Estável — operando dentro dos limites operacionais.',
      counts: 'Sinal verde quando não há sinais ativos de P0 nem P1.',
      tone: 'success',
      count: p2Count,
    },
  ];

  return (
    <TooltipProvider>
      <div
        role="group"
        aria-label="Resumo de severidade do hub de Conexões"
        className={cn('inline-flex items-center gap-1', className)}
      >
        {pills.map((p) => {
          const isActive = current === p.level;
          const isMuted = !isActive && p.count === 0;
          const tone = TONE_CLASSES[p.tone];
          const Icon = p.icon;
          return (
            <Tooltip key={p.level}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={`${p.label} — ${p.count} sinal${p.count === 1 ? '' : 'is'} ativo${p.count === 1 ? '' : 's'}${isActive ? ' (severidade global atual)' : ''}`}
                  aria-current={isActive ? 'true' : undefined}
                  className={cn(
                    'relative inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums transition-all',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-background',
                    tone.border,
                    tone.text,
                    tone.bg,
                    isActive && cn('ring-2 ring-offset-1 ring-offset-background', tone.ring),
                    isMuted && 'opacity-50 hover:opacity-100',
                  )}
                >
                  {isActive && p.level !== 'P2' && (
                    <span className="absolute -left-0.5 -top-0.5 flex h-2 w-2" aria-hidden="true">
                      <span
                        className={cn(
                          'absolute inline-flex h-full w-full animate-ping rounded-full opacity-70',
                          tone.pulse,
                        )}
                      />
                      <span
                        className={cn('relative inline-flex h-2 w-2 rounded-full', tone.pulse)}
                      />
                    </span>
                  )}
                  <Icon className="h-3 w-3" aria-hidden="true" />
                  <span>{p.label}</span>
                  <span
                    className={cn(
                      'ml-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold',
                      isLoading
                        ? 'bg-muted text-muted-foreground'
                        : p.count > 0
                          ? cn(tone.bg, tone.text, 'border', tone.border)
                          : 'bg-muted/60 text-muted-foreground',
                    )}
                  >
                    {isLoading ? '…' : p.count}
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="mb-1 text-xs font-semibold leading-tight">
                  {p.label} ·{' '}
                  {p.level === 'P0' ? 'Crítico' : p.level === 'P1' ? 'Atenção' : 'Estável'}
                </p>
                <p className="text-xs leading-relaxed">{p.meaning}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{p.counts}</p>
                {isActive && (
                  <p className="mt-1.5 border-t border-border/40 pt-1.5 text-[11px] font-medium leading-tight">
                    Severidade global atual.
                  </p>
                )}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
