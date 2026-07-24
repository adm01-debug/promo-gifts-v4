/**
 * ComparisonShortcutsCheatsheet (C6 #8) — Dialog com todos atalhos do comparador.
 * Aberto por Shift+? (registrado internamente).
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
import { Button } from '@/components/ui/button';

const SHORTCUTS: Array<{ keys: string[]; label: string; group: string }> = [
  { keys: ['G', 'X'], label: 'Ir para o Comparador', group: 'Navegação' },
  { keys: ['Shift', 'X'], label: 'Limpar comparação', group: 'Ações' },
  { keys: ['1'], label: 'Focar produto 1', group: 'Navegação' },
  { keys: ['2'], label: 'Focar produto 2', group: 'Navegação' },
  { keys: ['3'], label: 'Focar produto 3', group: 'Navegação' },
  { keys: ['4'], label: 'Focar produto 4', group: 'Navegação' },
  { keys: ['D'], label: 'Toggle: somente diferenças', group: 'Visualização' },
  { keys: ['R'], label: 'Toggle: radar visual', group: 'Visualização' },
  { keys: ['F'], label: 'Toggle: modo Foco', group: 'Visualização' },
  { keys: ['Shift', '?'], label: 'Mostrar este painel', group: 'Ajuda' },
];

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-7 min-w-[28px] items-center justify-center rounded border border-border bg-muted px-2 font-mono text-xs font-medium">
      {children}
    </kbd>
  );
}

export function ComparisonShortcutsCheatsheet() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.shiftKey && e.key === '?') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const grouped = SHORTCUTS.reduce<Record<string, typeof SHORTCUTS>>((acc, s) => {
    (acc[s.group] ??= []).push(s);
    return acc;
  }, {});

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label="Atalhos do teclado (Shift + ?)"
      >
        <Keyboard className="h-4 w-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="h-5 w-5" /> Atalhos do Comparador
            </DialogTitle>
            <DialogDescription>
              Atalhos globais. Pressione <Kbd>Shift</Kbd> + <Kbd>?</Kbd> para abrir/fechar.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 space-y-4">
            {Object.entries(grouped).map(([group, items]) => (
              <div key={group}>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group}
                </h4>
                <div className="grid gap-2">
                  {items.map((s) => (
                    <div key={s.label} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{s.label}</span>
                      <div className="flex items-center gap-1">
                        {s.keys.map((k, i) => (
                          <span key={i} className="flex items-center gap-1">
                            {i > 0 && <span className="text-xs text-muted-foreground">+</span>}
                            <Kbd>{k}</Kbd>
                          </span>
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
    </>
  );
}
