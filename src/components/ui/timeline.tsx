/**
 * Timeline — SSOT visual da timeline elegante usada no app
 * (QuoteHistoryPanel, AuditHistory e futuros usos).
 *
 * Componentes:
 *  - <TimelineLine />  → trilho vertical com gradient sutil
 *  - <TimelineDot />   → círculo do marco; glow opcional no item mais recente
 *
 * Tokens semânticos apenas — primary/border/background, sem cores hardcoded.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

interface TimelineLineProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Distância do topo (Tailwind/CSS), ex.: "top-2" | "top-4". */
  topClassName?: string;
  /** Distância do fundo, ex.: "bottom-2" | "bottom-4". */
  bottomClassName?: string;
  /**
   * Classe que posiciona o trilho no eixo X — deve alinhar ao CENTRO do dot.
   * Ex.: para dot `h-8 w-8` com `left-0` use `left-[15px]` (8*4/2 - 0.5).
   */
  leftClassName: string;
}

export function TimelineLine({
  topClassName = 'top-2',
  bottomClassName = 'bottom-2',
  leftClassName,
  className,
  ...rest
}: TimelineLineProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'absolute w-px bg-gradient-to-b from-primary/30 via-border/60 to-transparent',
        topClassName,
        bottomClassName,
        leftClassName,
        className,
      )}
      {...rest}
    />
  );
}

interface TimelineDotProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Aplica anel + glow do primary — use no item mais recente. */
  highlighted?: boolean;
  /** Classes de cor/borda específicas da ação (ex.: variant do badge). */
  toneClassName?: string;
  /** Conteúdo do dot — normalmente um ícone do lucide. */
  children: React.ReactNode;
}

export function TimelineDot({
  highlighted = false,
  toneClassName,
  className,
  children,
  ...rest
}: TimelineDotProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full border backdrop-blur-sm',
        'transition-all duration-200 group-hover:scale-105',
        toneClassName,
        highlighted &&
          'ring-2 ring-primary/25 ring-offset-1 ring-offset-background shadow-[0_0_12px_-2px_hsl(var(--primary)/0.4)]',

        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
