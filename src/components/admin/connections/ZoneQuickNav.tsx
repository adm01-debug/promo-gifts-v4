/**
 * ZoneQuickNav — Onda 14 + AI Router
 *
 * Quick nav com duplo papel:
 *   1. Anchor: clique no label rola até a zona (#zone-...).
 *   2. Toggle de visibilidade: clique no "olho" mostra/oculta a zona
 *      sem recarregar a página (persistido via useZoneVisibility).
 *
 * Inclui botão "Mostrar tudo" quando alguma zona está oculta e
 * shift+clique no chip para isolar (mostrar só aquela zona).
 */
import { Activity, Settings2, Network, Brain, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { ZoneId } from './useZoneVisibility';

interface ZoneDef {
  id: ZoneId;
  href: string;
  label: string;
  icon: typeof Activity;
}

const ZONES: ZoneDef[] = [
  { id: 'health', href: '#zone-health', label: 'Saúde', icon: Activity },
  { id: 'operation', href: '#zone-operation', label: 'Operação', icon: Settings2 },
  { id: 'connections', href: '#zone-connections', label: 'Conexões', icon: Network },
  { id: 'ai-router', href: '#zone-ai-router', label: 'AI Router', icon: Brain },
];

export function ZoneQuickNav({
  visible,
  onToggle,
  onIsolate,
  onShowAll,
  hiddenCount,
}: {
  visible: Record<ZoneId, boolean>;
  onToggle: (zone: ZoneId) => void;
  onIsolate: (zone: ZoneId) => void;
  onShowAll: () => void;
  hiddenCount: number;
}) {
  const handleAnchorClick = (e: React.MouseEvent, zone: ZoneDef) => {
    if (e.shiftKey) {
      e.preventDefault();
      onIsolate(zone.id);
      return;
    }
    if (!visible[zone.id]) {
      // Se está oculta e o usuário clica no label, mostra antes de rolar
      e.preventDefault();
      onToggle(zone.id);
      // Aguarda render e então rola
      requestAnimationFrame(() => {
        document
          .getElementById(`zone-${zone.id}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  };

  return (
    <TooltipProvider>
      <nav
        aria-label="Navegação por zonas com mostrar/ocultar"
        className="flex flex-wrap items-center gap-2 text-xs"
      >
        {ZONES.map((z) => {
          const isVisible = visible[z.id];
          const Icon = z.icon;
          return (
            <div
              key={z.id}
              className={cn(
                'inline-flex items-stretch overflow-hidden rounded-full border transition-colors',
                isVisible
                  ? 'border-border/60 bg-card'
                  : 'border-dashed border-border/50 bg-muted/30 opacity-70',
              )}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href={z.href}
                    onClick={(e) => handleAnchorClick(e, z)}
                    className={cn(
                      'inline-flex items-center gap-1.5 py-1 pl-2.5 pr-2 transition-colors',
                      isVisible
                        ? 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                        : 'text-muted-foreground/70 line-through decoration-dotted hover:text-foreground',
                    )}
                    aria-label={`${isVisible ? 'Ir para' : 'Mostrar e ir para'} zona ${z.label}`}
                  >
                    <Icon className="h-3 w-3" />
                    <span>{z.label}</span>
                  </a>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">
                    {isVisible
                      ? 'Clique para rolar até a zona.'
                      : 'Zona oculta — clique para mostrar e rolar.'}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    <kbd className="font-mono">Shift</kbd> + clique para isolar (mostrar só esta).
                  </p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isVisible}
                    aria-label={`${isVisible ? 'Ocultar' : 'Mostrar'} zona ${z.label}`}
                    onClick={() => onToggle(z.id)}
                    className={cn(
                      'inline-flex items-center justify-center border-l px-1.5 transition-colors',
                      isVisible
                        ? 'border-border/60 text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                        : 'border-border/40 text-muted-foreground/70 hover:bg-muted/60 hover:text-foreground',
                    )}
                  >
                    {isVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">{isVisible ? 'Ocultar zona' : 'Mostrar zona'}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          );
        })}

        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={onShowAll}
            className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-primary transition-colors hover:bg-primary/15"
            aria-label="Mostrar todas as zonas"
          >
            <RotateCcw className="h-3 w-3" />
            <span>
              Mostrar tudo ({hiddenCount} oculta{hiddenCount === 1 ? '' : 's'})
            </span>
          </button>
        )}
      </nav>
    </TooltipProvider>
  );
}
