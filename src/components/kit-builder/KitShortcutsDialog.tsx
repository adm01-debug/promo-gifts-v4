/**
 * Global keyboard shortcuts modal — opens with `?` key.
 */
import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Keyboard } from 'lucide-react';

const SHORTCUTS: Array<{ keys: string[]; label: string; section: string }> = [
  { keys: ['←', '→'], label: 'Navegar entre etapas', section: 'Wizard' },
  { keys: ['1', '2', '3', '4'], label: 'Pular para etapa específica', section: 'Wizard' },
  { keys: ['Ctrl', 'Z'], label: 'Desfazer', section: 'Edição' },
  { keys: ['Ctrl', 'Y'], label: 'Refazer', section: 'Edição' },
  { keys: ['Ctrl', 'S'], label: 'Salvar kit', section: 'Edição' },
  { keys: ['?'], label: 'Mostrar atalhos', section: 'Ajuda' },
  { keys: ['Esc'], label: 'Fechar diálogos', section: 'Ajuda' },
];

export function KitShortcutsDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      )
        return;
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const sections = [...new Set(SHORTCUTS.map((s) => s.section))];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Keyboard className="h-5 w-5 text-primary" /> Atalhos de teclado
          </DialogTitle>
          <DialogDescription>Acelere seu fluxo de trabalho</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {sections.map((section) => (
            <div key={section}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {section}
              </p>
              <div className="space-y-1.5">
                {SHORTCUTS.filter((s) => s.section === section).map((shortcut) => (
                  <div
                    key={shortcut.label}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/40"
                  >
                    <span className="text-sm">{shortcut.label}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, i) => (
                        <kbd
                          key={i}
                          className="rounded border border-border bg-muted px-1.5 py-0.5 font-display text-[10px] font-semibold tabular-nums shadow-sm"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
