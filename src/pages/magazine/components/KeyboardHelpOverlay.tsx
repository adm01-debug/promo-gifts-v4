/**
 * KeyboardHelpOverlay — cheat sheet dos atalhos do viewer público.
 * Acionado por `?` ou pelo botão de ajuda. Fecha com ESC ou clique fora.
 */
import { memo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Shortcut {
  keys: string[];
  label: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: ['←', 'PgUp'], label: 'Página anterior' },
  { keys: ['→', 'PgDn', 'Espaço'], label: 'Próxima página' },
  { keys: ['Home'], label: 'Ir para o começo' },
  { keys: ['End'], label: 'Ir para o fim' },
  { keys: ['F'], label: 'Alternar tela cheia' },
  { keys: ['T'], label: 'Abrir sumário' },
  { keys: ['B'], label: 'Marcar/desmarcar página' },
  { keys: ['P'], label: 'Modo apresentação (auto-advance)' },
  { keys: ['?'], label: 'Mostrar/ocultar este painel' },
  { keys: ['Esc'], label: 'Fechar sumário / zoom / apresentação' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const KeyboardHelpOverlay = memo(({ open, onOpenChange }: Props) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Atalhos de teclado</DialogTitle>
        </DialogHeader>
        <ul className="mt-2 space-y-2 text-sm">
          {SHORTCUTS.map((s) => (
            <li key={s.label} className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">{s.label}</span>
              <span className="flex gap-1">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-wide text-foreground"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">
          Marcadores ficam salvos neste navegador. Nada é enviado ao servidor.
        </p>
      </DialogContent>
    </Dialog>
  );
});
