import {
  Scale,
  Box,
  ArrowUpDown,
  ArrowLeftRight,
  MoveHorizontal,
  Droplets,
  Circle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductDimensionsProps {
  dimensions?: {
    height_cm?: number | null;
    width_cm?: number | null;
    length_cm?: number | null;
    diameter_cm?: number | null;
    circumference_cm?: number | null;
    weight_g?: number | null;
    capacity_ml?: number | null;
  };
  compact?: boolean;
}

interface SpecItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
  iconBgClass?: string;
  iconColorClass?: string;
  compact?: boolean;
}

function SpecItem({
  icon,
  label,
  value,
  unit,
  iconBgClass = 'bg-primary/10',
  iconColorClass = 'text-primary',
  compact,
}: SpecItemProps) {
  if (compact) {
    return (
      <div className="flex min-w-0 items-center gap-2 rounded-xl border border-border/40 bg-secondary/40 px-2.5 py-2.5">
        <div
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg [&_svg]:h-3.5 [&_svg]:w-3.5',
            iconBgClass,
          )}
        >
          <span className={iconColorClass}>{icon}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="mb-0.5 truncate text-[10px] leading-none text-muted-foreground/70">
            {label}
          </p>
          <p className="truncate text-sm font-bold leading-none text-foreground">
            {value} <span className="text-[10px] font-normal text-muted-foreground">{unit}</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-secondary/50 p-4 text-center">
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
          iconBgClass,
        )}
      >
        <span className={iconColorClass}>{icon}</span>
      </div>
      <p className="text-[11px] leading-tight text-muted-foreground">{label}</p>
      <p className="text-base font-bold leading-none text-foreground">{value}</p>
      <p className="text-[10px] leading-none text-muted-foreground">{unit}</p>
    </div>
  );
}

export function ProductDimensions({ dimensions, compact }: ProductDimensionsProps) {
  if (!dimensions) return null;

  const { height_cm, width_cm, length_cm, diameter_cm, circumference_cm, weight_g, capacity_ml } =
    dimensions;

  const hasAnySpec =
    height_cm ||
    width_cm ||
    length_cm ||
    diameter_cm ||
    circumference_cm ||
    weight_g ||
    capacity_ml;

  if (!hasAnySpec) return null;

  const formatWeight = (g: number) => {
    if (g >= 1000)
      return { val: (g / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 }), unit: 'kg' };
    return { val: g.toLocaleString('pt-BR'), unit: 'g' };
  };

  const formatCapacity = (ml: number) => {
    if (ml >= 1000)
      return { val: (ml / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }), unit: 'L' };
    return { val: ml.toLocaleString('pt-BR'), unit: 'ml' };
  };

  const specs: SpecItemProps[] = [];

  if (diameter_cm) {
    specs.push({
      icon: <Box className="h-5 w-5" />,
      label: 'Diâmetro',
      value: `${diameter_cm}`,
      unit: 'cm',
    });
  }
  if (circumference_cm) {
    specs.push({
      icon: <Circle className="h-5 w-5" />,
      label: 'Circunferência',
      value: `${circumference_cm}`,
      unit: 'cm',
    });
  }
  if (height_cm) {
    specs.push({
      icon: <ArrowUpDown className="h-5 w-5" />,
      label: 'Altura',
      value: `${height_cm}`,
      unit: 'cm',
    });
  }
  if (width_cm) {
    specs.push({
      icon: <ArrowLeftRight className="h-5 w-5" />,
      label: 'Largura',
      value: `${width_cm}`,
      unit: 'cm',
    });
  }
  if (length_cm) {
    specs.push({
      icon: <MoveHorizontal className="h-5 w-5" />,
      label: 'Profundidade',
      value: `${length_cm}`,
      unit: 'cm',
    });
  }
  if (capacity_ml) {
    const cap = formatCapacity(capacity_ml);
    specs.push({
      icon: <Droplets className="h-5 w-5" />,
      label: 'Capacidade',
      value: cap.val,
      unit: cap.unit,
      iconBgClass: 'bg-primary/10',
      iconColorClass: 'text-primary',
    });
  }
  if (weight_g) {
    const w = formatWeight(weight_g);
    specs.push({
      icon: <Scale className="h-5 w-5" />,
      label: 'Peso',
      value: w.val,
      unit: w.unit,
      iconBgClass: 'bg-info/10',
      iconColorClass: 'text-info',
    });
  }

  if (compact) {
    return (
      <div className="grid grid-cols-3 gap-2">
        {specs.map((spec, index) => (
          <SpecItem key={index} {...spec} compact />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="font-display text-lg font-semibold text-foreground">Especificações</h3>
      <div className="grid grid-cols-3 gap-3">
        {specs.map((spec, index) => (
          <SpecItem key={index} {...spec} />
        ))}
      </div>
    </div>
  );
}
