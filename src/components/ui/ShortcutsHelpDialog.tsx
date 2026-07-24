import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  Search,
  ShoppingCart,
  Plus,
  MessageSquare,
  Package,
  SlidersHorizontal,
  ImagePlus,
  Calculator,
  PlayCircle,
} from 'lucide-react';
import { useOptionalOnboardingContext } from '@/contexts/OnboardingContext';

export function ShortcutsHelpDialog() {
  const [open, setOpen] = useState(false);
  const onboarding = useOptionalOnboardingContext();

  const handleRestartTour = () => {
    if (onboarding) {
      onboarding.restartTour();
      setOpen(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Open with '?' if not in an input
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement;
        const isInput =
          target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

        if (!isInput) {
          setOpen(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl border-primary/20 bg-background/95 backdrop-blur-xl">
        <DialogHeader>
          <div className="mb-2 flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Command className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle className="font-display text-xl">Atalhos de Teclado</DialogTitle>
          </div>
          <DialogDescription>
            Aumente sua produtividade usando os comandos rápidos do sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Global Group */}
          <div className="space-y-4">
            <h3 className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Comandos Globais
            </h3>
            <div className="space-y-3">
              <ShortcutItem icon={Search} label="Buscar Produto / Comando" keys={['Ctrl', 'K']} />
              <ShortcutItem icon={MessageSquare} label="Fale com o Flow" keys={['Ctrl', 'J']} />
              <ShortcutItem
                icon={Search}
                label="Busca por Voz (Flow)"
                keys={['Ctrl', 'Shift', 'V']}
              />
              <ShortcutItem icon={Plus} label="Novo Orçamento" keys={['Ctrl', 'Shift', 'N']} />
              <ShortcutItem
                icon={ShoppingCart}
                label="Abrir Carrinho"
                keys={['Ctrl', 'Shift', 'C']}
              />
              <ShortcutItem icon={Command} label="Ver Atalhos" keys={['?']} />
            </div>
          </div>

          {/* Navigation Group (Alt) */}
          <div className="space-y-4">
            <h3 className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Navegação Rápida
            </h3>
            <div className="space-y-3">
              <ShortcutItem icon={Package} label="Ir para Catálogo" keys={['Alt', 'P']} />
              <ShortcutItem icon={Plus} label="Novo Orçamento" keys={['Alt', 'N']} />
              <ShortcutItem icon={SlidersHorizontal} label="Super Filtro" keys={['Alt', 'F']} />
              <ShortcutItem icon={ImagePlus} label="Gerador de Mockup" keys={['Alt', 'M']} />
              <ShortcutItem icon={Calculator} label="Simulador" keys={['Alt', 'S']} />
              <ShortcutItem
                icon={Package}
                label="Ir para Meus Kits"
                keys={['G', 'K']}
                sub="Sequência"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="mt-6 items-center border-t border-border/50 pt-4 sm:justify-between">
          <p className="mb-4 text-center text-[10px] italic text-muted-foreground sm:mb-0 sm:text-left">
            Dica: Digite <code className="font-bold text-primary">/</code> na busca para ver
            comandos operacionais.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRestartTour}
            className="h-8 gap-2 border-primary/20 text-xs hover:bg-primary/10"
          >
            <PlayCircle className="h-3.5 w-3.5 text-primary" />
            Reiniciar Tour do Sistema
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ShortcutItem({
  icon: Icon,
  label,
  keys,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  keys: string[];
  sub?: string;
}) {
  return (
    <div className="group flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div className="rounded bg-muted/50 p-1.5 text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div>
          <span className="text-sm font-medium">{label}</span>
          {sub && (
            <span className="block text-[10px] leading-none text-muted-foreground">{sub}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        {keys.map((key, i) => (
          <span key={i} className="flex items-center">
            <Badge
              variant="outline"
              className="h-5 border-border/50 bg-muted/30 px-1.5 font-mono text-[10px] shadow-sm"
            >
              {key}
            </Badge>
            {i < keys.length - 1 && (
              <span className="px-0.5 text-[10px] text-muted-foreground">+</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
