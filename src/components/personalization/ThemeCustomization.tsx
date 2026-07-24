/**
 * ThemeCustomization — controles para customizar tema visual da personalização (skin do simulador/mockup).
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Palette } from 'lucide-react';

export interface ThemeCustomizationValue {
  borderRadius: number;
  showShadow: boolean;
  highlightContrast: number;
}

interface ThemeCustomizationProps {
  value: ThemeCustomizationValue;
  onChange: (next: ThemeCustomizationValue) => void;
}

export function ThemeCustomization({ value, onChange }: ThemeCustomizationProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Palette className="h-4 w-4 text-primary" /> Customização Visual
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Arredondamento ({value.borderRadius}px)</Label>
          <Slider
            value={[value.borderRadius]}
            min={0}
            max={24}
            step={1}
            onValueChange={([v]) => onChange({ ...value, borderRadius: v })}
          />
        </div>
        <div className="space-y-2">
          <Label>Contraste de realce ({value.highlightContrast}%)</Label>
          <Slider
            value={[value.highlightContrast]}
            min={0}
            max={100}
            step={5}
            onValueChange={([v]) => onChange({ ...value, highlightContrast: v })}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="show-shadow">Mostrar sombra</Label>
          <Switch
            id="show-shadow"
            checked={value.showShadow}
            onCheckedChange={(v) => onChange({ ...value, showShadow: v })}
          />
        </div>
      </CardContent>
    </Card>
  );
}
