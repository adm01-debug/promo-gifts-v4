/**
 * TechniqueConfigCard — Configure colors and size for a selected technique.
 */
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Paintbrush, Palette, Ruler, Trash2 } from 'lucide-react';
import { type SelectedTechniqueConfig, availableSizes } from './types';

interface Props {
  config: SelectedTechniqueConfig;
  onUpdate: (updated: SelectedTechniqueConfig) => void;
  onRemove: () => void;
}

export function TechniqueConfigCard({ config, onUpdate, onRemove }: Props) {
  const { technique, colors, sizeOption } = config;
  const maxColors = technique.maxColors || 4;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Paintbrush className="h-4 w-4 text-primary" />
              {technique.techniqueName}
            </CardTitle>
            <CardDescription className="text-xs">
              {technique.componentName} • {technique.locationName}
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onRemove} aria-label="Excluir">
            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="flex items-center gap-1 text-xs font-medium">
            <Palette className="h-3 w-3" />
            Cores
          </label>
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: maxColors }, (_, i) => i + 1).map((num) => (
              <Button
                key={num}
                variant={colors === num ? 'default' : 'outline'}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => onUpdate({ ...config, colors: num })}
              >
                {num}
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <label className="flex items-center gap-1 text-xs font-medium">
            <Ruler className="h-3 w-3" />
            Tamanho
          </label>
          <Select
            value={sizeOption}
            onValueChange={(val) => {
              const modifier = availableSizes.find((s) => s.value === val)?.modifier || 1;
              onUpdate({ ...config, sizeOption: val, sizeModifier: modifier });
            }}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableSizes.map((size) => (
                <SelectItem key={size.value} value={size.value} className="text-xs">
                  {size.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
