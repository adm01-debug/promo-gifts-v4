/**
 * ZoneCommandTrigger — botão pequeno no header que abre o ZoneCommandPalette.
 * Mostra a dica visual do atalho ⌘K / Ctrl+K.
 */
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ZoneCommandTriggerProps {
  onOpen: () => void;
  className?: string;
}

export function ZoneCommandTrigger({ onOpen, className }: ZoneCommandTriggerProps) {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform);
  const shortcut = isMac ? '⌘K' : 'Ctrl+K';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onOpen}
          aria-label="Buscar zona ou módulo"
          className={className}
        >
          <Search className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          <span className="text-xs">Buscar</span>
          <kbd className="ml-2 inline-flex items-center rounded border border-border/60 bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {shortcut}
          </kbd>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[220px]">
        <p className="text-xs">Buscar zona ou módulo</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          Expande, mostra e leva direto ao módulo encontrado.
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
