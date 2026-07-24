/**
 * ZoneSection — Onda 14
 *
 * Wrapper semântico para agrupar conteúdo em "zonas" claras dentro de uma
 * página densa (ex: /admin/conexoes). Garante:
 *   - <section> com aria-labelledby para acessibilidade
 *   - Header consistente com ícone + título h2 + descrição (tom híbrido)
 *   - Âncora navegável (id) para deep-linking
 *   - Espaçamento interno padronizado (space-y-4)
 *   - Suporte opcional a actions à direita do header
 */
import { type LucideIcon, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ZoneSectionProps {
  id: string;
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Tom semântico do header — afeta apenas o ícone + barra lateral */
  tone?: 'info' | 'neutral' | 'primary';
  actions?: React.ReactNode;
  /** Quando true, aplica anel + glow temporário (ex: deep-link de incidente) */
  highlight?: boolean;
  /** Estado colapsado (oculta conteúdo, mantém header). */
  collapsed?: boolean;
  /** Handler para alternar colapso. Se ausente, botão de toggle é omitido. */
  onToggleCollapse?: () => void;
  children: React.ReactNode;
  className?: string;
}

const TONE_CLS = {
  primary: { iconBg: 'bg-primary/10', iconColor: 'text-primary', bar: 'bg-primary/40' },
  info: {
    iconBg: 'bg-sky-500/10',
    iconColor: 'text-sky-600 dark:text-sky-400',
    bar: 'bg-sky-500/40',
  },
  neutral: { iconBg: 'bg-muted', iconColor: 'text-muted-foreground', bar: 'bg-border' },
} as const;

export function ZoneSection({
  id,
  icon: iconElement,
  title,
  description,
  tone = 'primary',
  actions,
  highlight = false,
  collapsed = false,
  onToggleCollapse,
  children,
  className,
}: ZoneSectionProps) {
  const Icon = iconElement;
  const headingId = `${id}-heading`;
  const contentId = `${id}-content`;
  const tcls = TONE_CLS[tone];

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn(
        '-mx-2 scroll-mt-24 space-y-4 rounded-xl px-2 py-1 transition-shadow duration-500',
        highlight &&
          'shadow-[0_0_0_4px_hsl(var(--primary)/0.15)] ring-2 ring-primary/60 ring-offset-2 ring-offset-background',
        className,
      )}
    >
      <header className="flex items-start gap-3">
        <span className={cn('mt-1 h-8 w-1 shrink-0 rounded-full', tcls.bar)} aria-hidden="true" />
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
            tcls.iconBg,
          )}
          aria-hidden="true"
        >
          <Icon className={cn('h-4 w-4', tcls.iconColor)} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 id={headingId} className="text-base font-semibold leading-tight tracking-tight">
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{description}</p>
          )}
        </div>
        {(actions || onToggleCollapse) && (
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            {onToggleCollapse && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={onToggleCollapse}
                    aria-expanded={!collapsed}
                    aria-controls={contentId}
                    aria-label={collapsed ? `Expandir ${title}` : `Colapsar ${title}`}
                  >
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 transition-transform duration-200',
                        collapsed && '-rotate-90',
                      )}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {collapsed ? 'Expandir zona' : 'Colapsar zona'}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        )}
      </header>
      <div id={contentId} hidden={collapsed} className="space-y-4">
        {children}
      </div>
    </section>
  );
}
