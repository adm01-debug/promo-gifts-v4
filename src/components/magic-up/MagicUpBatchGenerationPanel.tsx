import { Layers3, Play } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { BATCH_PRESETS, type MagicUpBatchVariant } from '@/pages/magic-up/magicUpStrategy';

interface MagicUpBatchGenerationPanelProps {
  queue: MagicUpBatchVariant[];
  running: boolean;
  canGenerate: boolean;
  onSetQueue: (queue: MagicUpBatchVariant[]) => void;
  onRunQueue: () => void;
  onClearQueue: () => void;
}

export function MagicUpBatchGenerationPanel({
  queue,
  running,
  canGenerate,
  onSetQueue,
  onRunQueue,
  onClearQueue,
}: MagicUpBatchGenerationPanelProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Layers3 className="h-4 w-4 text-primary" /> Geração em lote
        </CardTitle>
        <CardDescription className="text-xs">
          Monte uma fila local de variações para canais, cenas e tons.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {BATCH_PRESETS.map((preset) => {
            const active =
              queue.length === preset.variants.length &&
              preset.variants.every((variant, index) => queue[index]?.id === variant.id);
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onSetQueue(preset.variants)}
                className={cn(
                  'rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-muted/30 text-foreground hover:border-primary/50',
                )}
                aria-pressed={active}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {queue.length > 0 && (
          <div className="space-y-2 rounded-lg border bg-muted/30 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <Badge variant="outline" className="text-[10px]">
                {queue.length} variações na fila
              </Badge>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[10px]"
                onClick={onClearQueue}
              >
                Limpar
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {queue.map((item) => (
                <Badge key={item.id} variant="secondary" className="text-[10px]">
                  {item.label}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          className="w-full gap-2"
          disabled={!queue.length || !canGenerate || running}
          onClick={onRunQueue}
        >
          <Play className="h-4 w-4" /> {running ? 'Gerando fila...' : 'Executar fila local'}
        </Button>
      </CardContent>
    </Card>
  );
}
