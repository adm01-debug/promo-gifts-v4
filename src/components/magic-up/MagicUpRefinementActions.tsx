import { Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { REFINEMENT_ACTIONS, type MagicUpRefinement } from '@/pages/magic-up/magicUpStrategy';

interface MagicUpRefinementActionsProps {
  activeRefinement: MagicUpRefinement | null;
  onApply: (refinement: MagicUpRefinement) => void;
}

export function MagicUpRefinementActions({
  activeRefinement,
  onApply,
}: MagicUpRefinementActionsProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" /> Refinamentos rápidos
        </CardTitle>
        <CardDescription className="text-xs">
          Ajuste a intenção criativa sem perder briefing, produto ou Brand Kit.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {activeRefinement && (
          <Badge variant="secondary" className="text-[10px]">
            Aplicado: {activeRefinement.label}
          </Badge>
        )}
        <div
          className="grid grid-cols-2 gap-2"
          role="group"
          aria-label="Refinamentos rápidos do Magic Up"
        >
          {REFINEMENT_ACTIONS.map((item) => {
            const active = activeRefinement?.id === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onApply(item)}
                className={cn(
                  'rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active
                    ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/30'
                    : 'border-border bg-muted/30 text-foreground hover:border-primary/50 hover:bg-accent/50',
                )}
                aria-pressed={active}
                title={item.instruction}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
