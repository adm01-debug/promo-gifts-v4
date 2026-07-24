import { SlidersHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  ASPECT_RATIOS,
  COMPOSITIONS,
  CREATIVE_MODES,
  NEGATIVE_PROMPTS,
  QUALITY_MODES,
  toHuman,
  type MagicUpCreativeControls as Controls,
} from '@/pages/magic-up/magicUpStrategy';

interface MagicUpCreativeControlsProps {
  value: Controls;
  onChange: (value: Controls) => void;
}

const CONTROL_GROUPS: Array<{
  field: keyof Omit<Controls, 'negativePrompt'>;
  label: string;
  options: string[];
}> = [
  { field: 'creativeMode', label: 'Modo', options: CREATIVE_MODES },
  { field: 'composition', label: 'Composição', options: COMPOSITIONS },
  { field: 'aspectRatio', label: 'Formato', options: ASPECT_RATIOS },
  { field: 'qualityMode', label: 'Qualidade', options: QUALITY_MODES },
];

export function MagicUpCreativeControls({ value, onChange }: MagicUpCreativeControlsProps) {
  const toggleNegativePrompt = (item: string) => {
    const active = value.negativePrompt.includes(item);
    onChange({
      ...value,
      negativePrompt: active
        ? value.negativePrompt.filter((v) => v !== item)
        : [...value.negativePrompt, item],
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <SlidersHorizontal className="h-4 w-4 text-primary" /> Direção de arte Pro
        </CardTitle>
        <CardDescription className="text-xs">
          Controle modo criativo, composição, formato, qualidade e restrições visuais.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CONTROL_GROUPS.map(({ field, label, options }) => (
            <div key={field} className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{label}</Label>
              <Select
                value={value[field]}
                onValueChange={(next) => onChange({ ...value, [field]: next })}
              >
                <SelectTrigger className="h-9" aria-label={label}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.map((option) => (
                    <SelectItem key={option} value={option}>
                      {toHuman(option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs text-muted-foreground">Negative prompt</Label>
            <Badge variant="outline" className="text-[10px]">
              {value.negativePrompt.length} ativos
            </Badge>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {NEGATIVE_PROMPTS.map((item) => {
              const active = value.negativePrompt.includes(item);
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleNegativePrompt(item)}
                  className={cn(
                    'rounded-lg border px-2.5 py-1 text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    active
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/50',
                  )}
                  aria-pressed={active}
                >
                  {item}
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
