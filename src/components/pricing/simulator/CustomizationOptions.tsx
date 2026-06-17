import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Palette, Ruler, Loader2, AlertCircle } from 'lucide-react';
import { useTechniquePricing } from '@/hooks/simulation';
import type { ProductTechnique } from './types';

interface CustomizationOptionsProps {
  technique: ProductTechnique;
  colors: number;
  onColorsChange: (colors: number) => void;
  sizeOption: string | null;
  onSizeChange: (size: string | null) => void;
  onTableCodeChange?: (tableCode: string | null) => void;
}

export function CustomizationOptions({
  technique,
  colors,
  onColorsChange,
  sizeOption,
  onSizeChange,
  onTableCodeChange,
}: CustomizationOptionsProps) {
  const { colorOptions, sizeOptions, hasPriceByColor, isLoading, error, findMatchingTable } =
    useTechniquePricing(technique.techniqueCode);

  // Atualizar tabela de preços quando muda cores ou tamanho
  useEffect(() => {
    if (onTableCodeChange) {
      const table = findMatchingTable(colors, sizeOption ?? '');
      onTableCodeChange(table?.tableCode || null);
    }
  }, [colors, sizeOption, findMatchingTable, onTableCodeChange]);

  // Definir valores iniciais quando opções carregam
  useEffect(() => {
    if (colorOptions.length > 0 && colors === 0) {
      onColorsChange(colorOptions[0].value);
    }
    if (sizeOptions.length > 0 && !sizeOption) {
      onSizeChange(sizeOptions[0].value);
    }
  }, [colorOptions, sizeOptions, colors, sizeOption, onColorsChange, onSizeChange]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Carregando opções...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-destructive">
        <AlertCircle className="mb-2 h-5 w-5" />
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  // Se não há opções configuráveis, mostrar mensagem
  if (!hasPriceByColor && sizeOptions.length === 0) {
    return (
      <div className="rounded-lg bg-muted/50 p-4 text-center">
        <p className="text-sm text-muted-foreground">
          Esta técnica não possui opções configuráveis de cores ou tamanho.
        </p>
        {technique.maxWidth && technique.maxHeight && (
          <p className="mt-2 text-sm">
            Área de gravação:{' '}
            <strong>
              {technique.maxWidth} x {technique.maxHeight} mm
            </strong>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Colors - Condicional */}
      {hasPriceByColor && colorOptions.length > 0 && (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <Palette className="h-4 w-4 text-primary" />
            Número de Cores
          </label>
          <div className="flex flex-wrap gap-2">
            {colorOptions.map((opt) => (
              <Button
                key={opt.value}
                variant={colors === opt.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => onColorsChange(opt.value)}
                className="min-w-12"
              >
                {opt.label}
              </Button>
            ))}
          </div>
          {technique.maxColors && (
            <p className="text-xs text-muted-foreground">
              Máximo suportado nesta área: {technique.maxColors} cores
            </p>
          )}
        </div>
      )}

      {/* Size - Condicional */}
      {sizeOptions.length > 1 && (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <Ruler className="h-4 w-4 text-primary" />
            Tamanho da Gravação
          </label>
          <Select value={sizeOption ?? ''} onValueChange={onSizeChange}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tamanho" />
            </SelectTrigger>
            <SelectContent>
              {sizeOptions.map((size) => (
                <SelectItem key={size.value} value={size.value}>
                  {size.label}
                  <span className="ml-2 text-muted-foreground">({size.areaCm2} cm²)</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Size único - mostrar informação */}
      {sizeOptions.length === 1 && (
        <div className="rounded-lg bg-muted/50 p-3 text-sm">
          <p className="flex items-center gap-2 text-muted-foreground">
            <Ruler className="h-4 w-4" />
            Tamanho da gravação:{' '}
            <strong>
              {sizeOptions[0].label} ({sizeOptions[0].areaCm2} cm²)
            </strong>
          </p>
        </div>
      )}

      {/* Area info from technique if no size options */}
      {sizeOptions.length === 0 && technique.maxWidth && technique.maxHeight && (
        <div className="rounded-lg bg-muted/50 p-3 text-sm">
          <p className="text-muted-foreground">
            Área máxima de gravação:{' '}
            <strong>
              {technique.maxWidth} x {technique.maxHeight} mm
            </strong>
            {technique.maxArea && <span> ({technique.maxArea} cm²)</span>}
          </p>
        </div>
      )}
    </div>
  );
}
