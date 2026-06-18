/**
 * ProductVariationAxesConfig — configura quais eixos de variação
 * o produto utiliza (Cor, Tamanho, Capacidade, Gênero)
 *
 * Lê os valores existentes das variantes e permite habilitar/desabilitar eixos.
 * Gênero é um eixo especial que lê/escreve em products.gender (nível de produto).
 */

import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dbInvoke } from '@/lib/db/postgrest';
import { Palette, Ruler, Beaker, Settings2, ChevronDown, ChevronRight, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

/* ── Types ── */

interface AxisDefinition {
  key: string;
  label: string;
  icon: React.ElementType;
  description: string;
  field: string; // campo no product_variants
}

const VARIANT_AXES: AxisDefinition[] = [
  {
    key: 'color',
    label: 'Cor',
    icon: Palette,
    description: 'Variações por cor (hex, nome)',
    field: 'color_name',
  },
  {
    key: 'size',
    label: 'Tamanho',
    icon: Ruler,
    description: 'Variações por tamanho (PP, P, M, G, GG...)',
    field: 'size_code',
  },
  {
    key: 'capacity',
    label: 'Capacidade',
    icon: Beaker,
    description: 'Variações por volume/capacidade (ml)',
    field: 'capacity_ml',
  },
];

const PRESET_SIZES = ['PP', 'P', 'M', 'G', 'GG', 'XG', '2XG', '3XG'];
const SIZE_ORDER = [...PRESET_SIZES, 'EG', 'EGG'];

const GENDER_OPTIONS = [
  { value: 'unissex', label: 'Unissex' },
  { value: 'masculino', label: 'Masculino' },
  { value: 'feminino', label: 'Feminino' },
  { value: 'infantil', label: 'Infantil' },
];

interface ProductVariationAxesConfigProps {
  productId: string;
  gender?: string;
  onGenderChange?: (value: string) => void;
}

interface VariantRecord {
  id: string;
  color_name: string | null;
  color_hex: string | null;
  size_code: string | null;
  capacity_ml: number | null;
  is_active: boolean;
}

/* ── Component ── */

export function ProductVariationAxesConfig({
  productId,
  gender,
  onGenderChange,
}: ProductVariationAxesConfigProps) {
  const [expandedAxis, setExpandedAxis] = useState<string | null>(null);

  // Fetch existing variants to detect active axes
  const { data: variants = [], isLoading } = useQuery({
    queryKey: ['product-variants-axes', productId],
    queryFn: async () => {
      const { records } = await dbInvoke<VariantRecord>({
        table: 'product_variants',
        operation: 'select',
        filters: { product_id: productId, is_active: true },
        select: 'id, color_name, color_hex, size_code, capacity_ml, is_active',
        limit: 500,
      });
      return records;
    },
    enabled: !!productId,
    staleTime: 2 * 60 * 1000,
  });

  // Derive which axes are active and their unique values
  const axisState = useMemo(() => {
    const state: Record<string, { active: boolean; values: string[] }> = {};

    for (const axis of VARIANT_AXES) {
      const values = new Set<string>();
      for (const v of variants) {
        const val = v[axis.field as keyof VariantRecord];
        if (val !== null && val !== '' && val !== false) {
          values.add(String(val));
        }
      }
      state[axis.key] = {
        active: values.size > 0,
        values: [...values].sort((a, b) => {
          if (axis.key === 'size') {
            const ia = SIZE_ORDER.indexOf(a.toUpperCase());
            const ib = SIZE_ORDER.indexOf(b.toUpperCase());
            if (ia !== -1 && ib !== -1) return ia - ib;
            if (ia !== -1) return -1;
            if (ib !== -1) return 1;
          }
          if (axis.key === 'capacity') {
            return parseFloat(a) - parseFloat(b);
          }
          return a.localeCompare(b, 'pt-BR');
        }),
      };
    }

    return state;
  }, [variants]);

  const activeVariantCount = Object.values(axisState).filter((s) => s.active).length;
  const hasGender = !!gender;
  const totalActive = activeVariantCount + (hasGender ? 1 : 0);

  const toggleAxis = useCallback((axisKey: string) => {
    setExpandedAxis((prev) => (prev === axisKey ? null : axisKey));
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Summary */}
      <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
        <Settings2 className="h-3.5 w-3.5" />
        <span>
          {totalActive === 0
            ? 'Nenhum eixo de variação configurado'
            : `${totalActive} ${totalActive === 1 ? 'eixo ativo' : 'eixos ativos'}`}
        </span>
      </div>

      {/* Gender axis — special: product-level field with Select */}
      <GenderAxis
        gender={gender}
        onGenderChange={onGenderChange}
        isExpanded={expandedAxis === 'gender'}
        onToggle={() => toggleAxis('gender')}
      />

      {/* Variant-based axes */}
      {VARIANT_AXES.map((axis) => {
        const state = axisState[axis.key];
        const isExpanded = expandedAxis === axis.key;
        const AxisIcon = axis.icon;

        return (
          <Collapsible key={axis.key} open={isExpanded} onOpenChange={() => toggleAxis(axis.key)}>
            <div
              className={cn(
                'rounded-lg border transition-colors',
                state.active
                  ? 'border-primary/30 bg-primary/5'
                  : 'border-border/40 bg-muted/10 opacity-60',
              )}
            >
              <CollapsibleTrigger className="flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors hover:bg-accent/30">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-md',
                    state.active ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
                  )}
                >
                  <AxisIcon className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{axis.label}</span>
                    {state.active ? (
                      <Badge
                        variant="secondary"
                        className="border-primary/20 bg-primary/10 px-1.5 py-0 text-[10px] text-primary"
                      >
                        {state.values.length} {state.values.length === 1 ? 'valor' : 'valores'}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                        Inativo
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground">{axis.description}</p>
                </div>

                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="space-y-2 border-t border-border/30 px-3 pb-3 pt-1">
                  {state.values.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {state.values.map((val) => (
                        <Badge
                          key={val}
                          variant="secondary"
                          className={cn(
                            'gap-1 px-2 py-0.5 text-xs',
                            axis.key === 'color' && 'pl-1',
                          )}
                        >
                          {axis.key === 'color' && (
                            <ColorDot
                              hex={variants.find((v) => v.color_name === val)?.color_hex || null}
                            />
                          )}
                          {axis.key === 'capacity' ? `${val} ml` : val}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] italic text-muted-foreground">
                      Sem valores — adicione variações com {axis.label.toLowerCase()} para popular
                      automaticamente
                    </p>
                  )}

                  {axis.key === 'size' && (
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">
                        Tamanhos sugeridos:
                      </Label>
                      <div className="flex flex-wrap gap-1">
                        {PRESET_SIZES.map((size) => {
                          const exists = state.values.some((v) => v.toUpperCase() === size);
                          return (
                            <button
                              key={size}
                              type="button"
                              disabled={exists}
                              className={cn(
                                'rounded-md border px-2 py-0.5 text-[11px] transition-colors',
                                exists
                                  ? 'cursor-default border-primary/30 bg-primary/10 text-primary'
                                  : 'border-border text-muted-foreground hover:border-primary/40 hover:bg-primary/5',
                              )}
                            >
                              {size}
                              {exists && ' ✓'}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <p className="text-[10px] leading-relaxed text-muted-foreground/70">
                    💡 Os valores são extraídos automaticamente das variações cadastradas. Para
                    adicionar um novo valor, crie uma variação com o {axis.label.toLowerCase()}{' '}
                    desejado.
                  </p>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}
    </div>
  );
}

/* ── Gender Axis (special) ── */

function GenderAxis({
  gender,
  onGenderChange,
  isExpanded,
  onToggle,
}: {
  gender?: string;
  onGenderChange?: (v: string) => void;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const hasValue = !!gender;
  const genderLabel = GENDER_OPTIONS.find((o) => o.value === gender)?.label || gender;

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div
        className={cn(
          'rounded-lg border transition-colors',
          hasValue ? 'border-primary/30 bg-primary/5' : 'border-border/40 bg-muted/10 opacity-60',
        )}
      >
        <CollapsibleTrigger className="flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors hover:bg-accent/30">
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-md',
              hasValue ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
            )}
          >
            <Users className="h-4 w-4" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Gênero</span>
              {hasValue ? (
                <Badge
                  variant="secondary"
                  className="border-primary/20 bg-primary/10 px-1.5 py-0 text-[10px] text-primary"
                >
                  {genderLabel}
                </Badge>
              ) : (
                <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                  Não definido
                </Badge>
              )}
            </div>
            <p className="truncate text-[11px] text-muted-foreground">
              Público-alvo primário do produto
            </p>
          </div>

          {isExpanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-border/30 px-3 pb-3 pt-1">
            <div className="max-w-xs">
              <Label className="mb-1.5 block text-[11px] text-muted-foreground">Público-alvo</Label>
              <Select value={gender ?? ''} onValueChange={(v) => onGenderChange?.(v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {GENDER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground/70">
              💡 Define o público-alvo do produto. Utilizado nos filtros do catálogo e nos
              orçamentos.
            </p>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

/* ── Helpers ── */

function ColorDot({ hex }: { hex: string | null }) {
  if (!hex) return null;
  return (
    <span
      className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-border/50"
      style={{ backgroundColor: hex }}
    />
  );
}
