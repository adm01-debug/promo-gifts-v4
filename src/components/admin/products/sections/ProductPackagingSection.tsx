/**
 * Packaging section — box/packaging dimensions, specs and packaging flags
 */
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { FieldLabel, SectionCard, type FormSectionProps } from '../ProductFormHelpers';
import { Package, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = FormSectionProps;

const PACKING_TYPES = [
  'Caixa',
  'Bolsa',
  'Estojo',
  'Sacola',
  'Envelope',
  'Lata',
  'Tubo',
  'Sem embalagem',
];
const MATERIALS = [
  'Papelão',
  'Papel Kraft',
  'Plástico',
  'TNT',
  'Veludo',
  'Metal',
  'Madeira',
  'Acrílico',
];
const COLORS = ['Kraft', 'Branco', 'Preto', 'Transparente', 'Prata', 'Dourado'];
const FINISHES = ['Fosco', 'Brilhante', 'Acetinado', 'Texturizado', 'Laminado'];

const PACKAGING_FLAGS = [
  {
    key: 'has_optional_packaging' as const,
    label: 'Embalagem Opcional',
    hint: 'A embalagem pode ser removida ou trocada pelo cliente',
  },
  {
    key: 'has_commercial_packaging' as const,
    label: 'Embalagem Nativa',
    hint: 'O produto já vem com embalagem comercial do fabricante',
  },
];

export function ProductPackagingSection({
  register: _register,
  numericProps,
  watch,
  setValue,
}: Props) {
  const packingType = watch?.('packing_type') ?? '';
  const packagingMaterial = watch?.('packaging_material') ?? '';
  const packagingColor = watch?.('packaging_color') ?? '';
  const packagingFinish = watch?.('packaging_finish') ?? '';

  return (
    <SectionCard
      id="packaging"
      title="Embalagem (Caixa)"
      icon={Package}
      subtitle="Dimensões e especificações da embalagem"
    >
      {/* Packaging Flags */}
      <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {PACKAGING_FLAGS.map(({ key, label, hint }) => {
          const value = !!watch?.(key);
          const toggle = () => setValue?.(key, !value);
          return (
            <div
              key={key}
              className={cn(
                'flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-all duration-200 hover:bg-accent/30',
                value ? 'border-primary/20 bg-primary/5' : 'border-border/50',
              )}
              onClick={toggle}
              role="switch"
              aria-checked={value}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggle();
                }
              }}
            >
              <div className="flex items-center gap-1.5">
                <Label className="cursor-pointer text-xs font-medium">{label}</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 shrink-0 cursor-help text-muted-foreground/40" />
                  </TooltipTrigger>
                  <TooltipContent>{hint}</TooltipContent>
                </Tooltip>
              </div>
              <div onClick={(e) => e.stopPropagation()}>
                <Switch checked={value} onCheckedChange={toggle} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Tipo + Material + Cor + Acabamento */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <FieldLabel
            htmlFor="packing_type"
            hint="Formato físico da embalagem que acompanha o produto"
          >
            Tipo de Embalagem
          </FieldLabel>
          <Select value={packingType} onValueChange={(v) => setValue?.('packing_type', v)}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {PACKING_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <FieldLabel
            htmlFor="packaging_material"
            hint="Material principal utilizado na fabricação da embalagem"
          >
            Material
          </FieldLabel>
          <Select
            value={packagingMaterial}
            onValueChange={(v) => setValue?.('packaging_material', v)}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {MATERIALS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <FieldLabel htmlFor="packaging_color" hint="Cor predominante da embalagem">
            Cor
          </FieldLabel>
          <Select value={packagingColor} onValueChange={(v) => setValue?.('packaging_color', v)}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {COLORS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <FieldLabel
            htmlFor="packaging_finish"
            hint="Tipo de acabamento visual/tátil da embalagem"
          >
            Acabamento
          </FieldLabel>
          <Select value={packagingFinish} onValueChange={(v) => setValue?.('packaging_finish', v)}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {FINISHES.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Dimensões Externas */}
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
        Externas
      </p>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <FieldLabel htmlFor="box_height_mm" hint="Altura externa da embalagem fechada">
            Altura (cm)
          </FieldLabel>
          <Input
            id="box_height_mm"
            {...numericProps('box_height_mm')}
            min="0"
            step="0.1"
            className="h-9"
          />
        </div>
        <div>
          <FieldLabel htmlFor="box_width_mm" hint="Largura externa da embalagem fechada">
            Largura (cm)
          </FieldLabel>
          <Input
            id="box_width_mm"
            {...numericProps('box_width_mm')}
            min="0"
            step="0.1"
            className="h-9"
          />
        </div>
        <div>
          <FieldLabel htmlFor="box_length_mm" hint="Profundidade externa da embalagem fechada">
            Profundidade (cm)
          </FieldLabel>
          <Input
            id="box_length_mm"
            {...numericProps('box_length_mm')}
            min="0"
            step="0.1"
            className="h-9"
          />
        </div>
      </div>

      {/* Dimensões Internas */}
      <p className="mb-1 mt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
        Internas
      </p>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <FieldLabel htmlFor="box_internal_height_cm" hint="Altura interna útil da embalagem">
            Altura (cm)
          </FieldLabel>
          <Input
            id="box_internal_height_cm"
            {...numericProps('box_internal_height_cm')}
            min="0"
            step="0.1"
            className="h-9"
          />
        </div>
        <div>
          <FieldLabel htmlFor="box_internal_width_cm" hint="Largura interna útil da embalagem">
            Largura (cm)
          </FieldLabel>
          <Input
            id="box_internal_width_cm"
            {...numericProps('box_internal_width_cm')}
            min="0"
            step="0.1"
            className="h-9"
          />
        </div>
        <div>
          <FieldLabel
            htmlFor="box_internal_length_cm"
            hint="Profundidade interna útil da embalagem"
          >
            Profundidade (cm)
          </FieldLabel>
          <Input
            id="box_internal_length_cm"
            {...numericProps('box_internal_length_cm')}
            min="0"
            step="0.1"
            className="h-9"
          />
        </div>
      </div>

      {/* Peso, Volume, Quantidades */}
      <div className="mt-1 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <FieldLabel htmlFor="box_weight_kg" hint="Peso da embalagem vazia (sem o produto)">
            Peso (kg)
          </FieldLabel>
          <Input
            id="box_weight_kg"
            {...numericProps('box_weight_kg')}
            min="0"
            step="0.01"
            className="h-9"
          />
        </div>
        <div>
          <FieldLabel htmlFor="box_volume_cm3" hint="Volume cúbico total da embalagem (A × L × P)">
            Volume (cm³)
          </FieldLabel>
          <Input id="box_volume_cm3" {...numericProps('box_volume_cm3')} min="0" className="h-9" />
        </div>
        <div>
          <FieldLabel
            htmlFor="box_quantity"
            hint="Quantidade de unidades do produto por caixa master/embarque"
          >
            Qtd. por Caixa
          </FieldLabel>
          <Input id="box_quantity" {...numericProps('box_quantity')} min="0" className="h-9" />
        </div>
        <div>
          <FieldLabel
            htmlFor="box_inner_quantity"
            hint="Quantidade por caixa interna/inner pack dentro da caixa master"
          >
            Qtd. Inner Pack
          </FieldLabel>
          <Input
            id="box_inner_quantity"
            {...numericProps('box_inner_quantity')}
            min="0"
            className="h-9"
          />
        </div>
      </div>
    </SectionCard>
  );
}
