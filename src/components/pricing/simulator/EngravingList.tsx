import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Paintbrush, Palette, Ruler, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ConfiguredEngraving } from "./types";

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
      <div className="text-center py-6 border-2 border-dashed rounded-lg">
        <Paintbrush className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground mb-4">
          Nenhuma gravação adicionada
        </p>
        <Button onClick={onAddNew} variant="outline" size="sm">
          <Plus className="w-4 h-4 mr-2" />
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
            <Plus className="w-4 h-4 mr-2" />
            Adicionar
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {engravings.map((engraving, index) => (
          <Card 
            key={engraving.id} 
            className={cn(
              "transition-all",
              index === 0 && "border-primary/30 bg-primary/5"
            )}
          >
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <GripVertical className="w-4 h-4" />
                  <span className="text-xs font-medium w-5">{index + 1}.</span>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Paintbrush className="w-4 h-4 text-primary" />
                    <span className="font-medium text-sm truncate">
                      {engraving.technique.techniqueName}
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      📍 {engraving.technique.componentName} - {engraving.technique.locationName}
                    </span>
                    
                    {engraving.colors > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        <Palette className="w-3 h-3 mr-1" />
                        {engraving.colors} {engraving.colors === 1 ? 'cor' : 'cores'}
                      </Badge>
                    )}
                    
                    {engraving.sizeOption && (
                      <Badge variant="secondary" className="text-xs">
                        <Ruler className="w-3 h-3 mr-1" />
                        {engraving.sizeOption.replace('x', ' × ')} cm
                      </Badge>
                    )}
                  </div>
                </div>
                
                <Button
                  variant="ghost"
                  size="icon" aria-label="Excluir"
                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => onRemove(engraving.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!canAddMore && (
        <p className="text-xs text-muted-foreground text-center">
          Máximo de {maxEngravings} gravações atingido
        </p>
      )}
    </div>
  );
}
