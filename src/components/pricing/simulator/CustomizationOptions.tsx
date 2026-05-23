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
import type { ProductTechnique } from "./types";

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
  const {
    colorOptions,
    sizeOptions,
    hasPriceByColor,
    hasPriceByArea,
    isLoading,
    error,
    findMatchingTable,
  } = useTechniquePricing(technique.techniqueCode);

  // Atualizar tabela de preços quando muda cores ou tamanho
  useEffect(() => {
    if (onTableCodeChange) {
      const table = findMatchingTable(colors, sizeOption || '');
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
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Carregando opções...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
        <AlertCircle className="w-5 h-5 mb-2" />
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  // Se não há opções configuráveis, mostrar mensagem
  if (!hasPriceByColor && sizeOptions.length === 0) {
    return (
      <div className="p-4 rounded-lg bg-muted/50 text-center">
        <p className="text-sm text-muted-foreground">
          Esta técnica não possui opções configuráveis de cores ou tamanho.
        </p>
        {technique.maxWidth && technique.maxHeight && (
          <p className="text-sm mt-2">
            Área de gravação: <strong>{technique.maxWidth} x {technique.maxHeight} mm</strong>
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
          <label className="text-sm font-medium flex items-center gap-2">
            <Palette className="w-4 h-4 text-primary" />
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
          <label className="text-sm font-medium flex items-center gap-2">
            <Ruler className="w-4 h-4 text-primary" />
            Tamanho da Gravação
          </label>
          <Select value={sizeOption || ''} onValueChange={onSizeChange}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tamanho" />
            </SelectTrigger>
            <SelectContent>
              {sizeOptions.map((size) => (
                <SelectItem key={size.value} value={size.value}>
                  {size.label}
                  <span className="text-muted-foreground ml-2">
                    ({size.areaCm2} cm²)
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Size único - mostrar informação */}
      {sizeOptions.length === 1 && (
        <div className="p-3 rounded-lg bg-muted/50 text-sm">
          <p className="text-muted-foreground flex items-center gap-2">
            <Ruler className="w-4 h-4" />
            Tamanho da gravação:{' '}
            <strong>
              {sizeOptions[0].label} ({sizeOptions[0].areaCm2} cm²)
            </strong>
          </p>
        </div>
      )}

      {/* Area info from technique if no size options */}
      {sizeOptions.length === 0 && technique.maxWidth && technique.maxHeight && (
        <div className="p-3 rounded-lg bg-muted/50 text-sm">
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
