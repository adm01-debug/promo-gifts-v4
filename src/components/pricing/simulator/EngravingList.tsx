import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Paintbrush, Palette, Ruler, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ConfiguredEngraving } from './types';

interface EngravingListProps {
  engravings: ConfiguredEngraving[];
  onRemove: (id: string) => void;
  onAddNew: () => void;
  canAddMore: boolean;
  maxEngravings?: number;
}

export function EngravingList({
  engravings,
  onRemove,
  onAddNew,
  canAddMore,
  maxEngravings = 5,
}: EngravingListProps) {
  if (engravings.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed py-6 text-center">
        <Paintbrush className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
        <p className="mb-4 text-sm text-muted-foreground">Nenhuma gravação adicionada</p>
        <Button onClick={onAddNew} variant="outline" size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Gravação
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">
          Gravações ({engravings.length}/{maxEngravings})
        </h4>
        {canAddMore && (
          <Button onClick={onAddNew} variant="outline" size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Adicionar
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {engravings.map((engraving, index) => (
          <Card
            key={engraving.id}
            className={cn('transition-all', index === 0 && 'border-primary/30 bg-primary/5')}
          >
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <GripVertical className="h-4 w-4" />
                  <span className="w-5 text-xs font-medium">{index + 1}.</span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <Paintbrush className="h-4 w-4 text-primary" />
                    <span className="truncate text-sm font-medium">
                      {engraving.technique.techniqueName}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      ðŸ“ {engraving.technique.componentName} - {engraving.technique.locationName}
                    </span>

                    {engraving.colors > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        <Palette className="mr-1 h-3 w-3" />
                        {engraving.colors} {engraving.colors === 1 ? 'cor' : 'cores'}
                      </Badge>
                    )}

                    {engraving.sizeOption && (
                      <Badge variant="secondary" className="text-xs">
                        <Ruler className="mr-1 h-3 w-3" />
                        {engraving.sizeOption.replace('x', ' Ã— ')} cm
                      </Badge>
                    )}
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Excluir"
                  className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => onRemove(engraving.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!canAddMore && (
        <p className="text-center text-xs text-muted-foreground">
          Máximo de {maxEngravings} gravações atingido
        </p>
      )}
    </div>
  );
}
