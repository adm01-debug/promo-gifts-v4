/**
 * Personalization Config
 * Configuração de personalização para caixa e itens
 * Integrado com técnicas reais do banco externo via useProductCustomizationOptions
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Palette,
  Package,
  ChevronDown,
  ChevronUp,
  Check,
  Settings,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  formatCurrency,
  type KitBox,
  type KitItem,
  type KitItemPersonalization,
} from '@/lib/kit-builder';
import { useProductCustomizationOptions } from '@/hooks/products';
import { useCustomizationPriceReactive } from '@/hooks/simulation';
import type { GravacaoLocation } from '@/types/customization';

interface PersonalizationConfigProps {
  box: KitBox | null;
  items: KitItem[];
  kitQuantity?: number;
  boxPersonalization: KitItemPersonalization;
  itemPersonalizations: Record<string, KitItemPersonalization>;
  onBoxPersonalizationChange: (config: KitItemPersonalization) => void;
  onItemPersonalizationChange: (itemId: string, config: KitItemPersonalization) => void;
}

/** Flattened technique with location info */
interface FlatTechnique {
  technique_id: string;
  tecnica_nome: string;
  grupo_tecnica: string;
  codigo_tabela: string;
  location_name: string;
  location_code: string;
  max_cores: number;
  usa_dimensao: boolean;
  efetiva_largura_max: number;
  efetiva_altura_max: number;
}

function flattenTechniques(locations: GravacaoLocation[]): FlatTechnique[] {
  const result: FlatTechnique[] = [];
  for (const loc of locations) {
    for (const tech of loc.options) {
      result.push({
        technique_id: tech.technique_id,
        tecnica_nome: tech.tecnica_nome,
        grupo_tecnica: tech.grupo_tecnica,
        codigo_tabela: tech.codigo_tabela,
        location_name: loc.location_name,
        location_code: loc.location_code,
        max_cores: tech.max_cores,
        usa_dimensao: tech.usa_dimensao,
        efetiva_largura_max: tech.efetiva_largura_max,
        efetiva_altura_max: tech.efetiva_altura_max,
      });
    }
  }
  return result;
}

// ============================================
// Card de personalização — busca técnicas internamente
// ============================================

interface ItemPersonalizationCardProps {
  productId: string;
  displayName: string;
  imageUrl: string | null;
  personalization: KitItemPersonalization;
  onChange: (config: KitItemPersonalization) => void;
  isBox?: boolean;
  kitQuantity: number;
}

function ItemPersonalizationCard({
  productId,
  displayName,
  imageUrl,
  personalization,
  onChange,
  isBox = false,
  kitQuantity,
}: ItemPersonalizationCardProps) {
  const [isOpen, setIsOpen] = useState(personalization.enabled);

  // Fetch real techniques for this product
  const { data: options, isLoading: loadingTechniques } = useProductCustomizationOptions(productId);
  const techniques = useMemo(
    () => (options?.locations ? flattenTechniques(options.locations) : []),
    [options],
  );

  // Find current technique for reactive price
  const currentTech = techniques.find((t) => t.technique_id === personalization.techniqueId);

  // Reactive price from real RPC
  const { price: priceData, loading: priceLoading } = useCustomizationPriceReactive(
    personalization.enabled ? personalization.techniqueId || null : null,
    kitQuantity,
    personalization.colors || 1,
    personalization.width || null,
    personalization.height || null,
    currentTech?.usa_dimensao || false,
  );

  const currentUnitPrice = priceData?.preco_unitario ?? personalization.estimatedPrice;

  // #3 FIX: Sync estimatedPrice with RPC result so price-calculator picks it up
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (priceData?.success && priceData.preco_unitario !== null) {
      const rpcPrice = priceData.preco_unitario;
      onChangeRef.current({ ...personalization, estimatedPrice: rpcPrice });
    }
  }, [priceData?.preco_unitario, priceData?.success, personalization]);

  const handleToggle = (enabled: boolean) => {
    onChange({
      ...personalization,
      enabled,
      estimatedPrice: enabled ? personalization.estimatedPrice : undefined,
    });
    setIsOpen(enabled);
  };

  const handleTechniqueChange = (techniqueId: string) => {
    const tech = techniques.find((t) => t.technique_id === techniqueId);
    if (tech) {
      onChange({
        ...personalization,
        techniqueId: tech.technique_id,
        techniqueName: tech.tecnica_nome,
        techniqueCode: tech.codigo_tabela,
        position: tech.location_name,
        colors: Math.min(personalization.colors || 1, tech.max_cores),
        width: personalization.width || (tech.usa_dimensao ? tech.efetiva_largura_max : undefined),
        height: personalization.height || (tech.usa_dimensao ? tech.efetiva_altura_max : undefined),
        estimatedPrice: undefined,
      });
    }
  };

  const handleColorsChange = (colors: number) => {
    onChange({ ...personalization, colors });
  };

  const maxColors = currentTech?.max_cores || 6;
  const colorOptions = Array.from({ length: maxColors }, (_, i) => i + 1);

  return (
    <Card className={cn(personalization.enabled && 'border-primary/50 bg-primary/5')}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-md bg-secondary">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={displayName}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    {isBox ? (
                      <Package className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <Palette className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                )}
              </div>
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  {displayName}
                  {isBox && (
                    <Badge variant="outline" className="text-xs">
                      Caixa
                    </Badge>
                  )}
                </CardTitle>
                {personalization.enabled && personalization.techniqueName && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {personalization.techniqueName} • {personalization.colors || 1} cor(es)
                    {personalization.position && ` • ${personalization.position}`}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {personalization.enabled && (
                <span className="text-sm font-semibold">
                  {priceLoading ? (
                    <Loader2 className="inline h-3 w-3 animate-spin text-primary" />
                  ) : !personalization.techniqueId ? (
                    <span className="flex items-center gap-1 text-warning">
                      <AlertTriangle className="h-3 w-3" />
                      Sem técnica
                    </span>
                  ) : currentUnitPrice ? (
                    <span className="text-primary">+{formatCurrency(currentUnitPrice)}/un</span>
                  ) : (
                    <span className="flex items-center gap-1 text-warning">
                      <AlertTriangle className="h-3 w-3" />
                      R$ 0,00
                    </span>
                  )}
                </span>
              )}
              <Switch checked={personalization.enabled} onCheckedChange={handleToggle} />
              {personalization.enabled && (
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Expandir" className="h-8 w-8">
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
              )}
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {/* Técnica */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Técnica de Gravação</Label>
                {loadingTechniques ? (
                  <div className="flex h-10 items-center gap-2 rounded-md border bg-secondary/50 px-3">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Carregando...</span>
                  </div>
                ) : techniques.length === 0 ? (
                  <p className="py-2 text-sm text-muted-foreground">
                    Nenhuma técnica disponível para este produto
                  </p>
                ) : (
                  <Select
                    value={personalization.techniqueId ?? ''}
                    onValueChange={handleTechniqueChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a técnica..." />
                    </SelectTrigger>
                    <SelectContent>
                      {techniques.map((tech) => (
                        <SelectItem key={tech.technique_id} value={tech.technique_id}>
                          <span className="flex items-center gap-2">
                            <Badge variant="outline" className="px-1 py-0 text-[10px]">
                              {tech.grupo_tecnica}
                            </Badge>
                            {tech.tecnica_nome}
                            <span className="text-xs text-muted-foreground">
                              ({tech.location_name})
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <Label>Número de Cores</Label>
                <Select
                  value={String(personalization.colors || 1)}
                  onValueChange={(v) => handleColorsChange(parseInt(v, 10))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {colorOptions.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} {n === 1 ? 'cor' : 'cores'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Dimensões — somente se técnica usa dimensão */}
            {currentTech?.usa_dimensao && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>
                    Largura (cm){' '}
                    <span className="text-xs text-muted-foreground">
                      máx {currentTech.efetiva_largura_max}
                    </span>
                  </Label>
                  <Input
                    type="number"
                    step="0.1"
                    max={currentTech.efetiva_largura_max}
                    placeholder={`Até ${currentTech.efetiva_largura_max}cm`}
                    value={personalization.width ?? ''}
                    onChange={(e) =>
                      onChange({
                        ...personalization,
                        width: e.target.value
                          ? Math.min(parseFloat(e.target.value), currentTech.efetiva_largura_max)
                          : undefined,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    Altura (cm){' '}
                    <span className="text-xs text-muted-foreground">
                      máx {currentTech.efetiva_altura_max}
                    </span>
                  </Label>
                  <Input
                    type="number"
                    step="0.1"
                    max={currentTech.efetiva_altura_max}
                    placeholder={`Até ${currentTech.efetiva_altura_max}cm`}
                    value={personalization.height ?? ''}
                    onChange={(e) =>
                      onChange({
                        ...personalization,
                        height: e.target.value
                          ? Math.min(parseFloat(e.target.value), currentTech.efetiva_altura_max)
                          : undefined,
                      })
                    }
                  />
                </div>
              </div>
            )}

            {/* Preço detalhado */}
            {priceData?.success && (
              <div className="space-y-1 rounded-lg bg-secondary/50 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Preço unitário</span>
                  <span>{formatCurrency(priceData.preco_unitario ?? 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gravação ({kitQuantity}un)</span>
                  <span>{formatCurrency(priceData.valor_gravacao ?? 0)}</span>
                </div>
                {(priceData.setup_total ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Setup</span>
                    <span>{formatCurrency(priceData.setup_total ?? 0)}</span>
                  </div>
                )}
                <div className="mt-1 flex justify-between border-t pt-1 font-semibold">
                  <span>Total gravação</span>
                  <span className="text-primary">
                    {formatCurrency(priceData.total_cobrado ?? 0)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// ============================================
// Componente principal
// ============================================

export function PersonalizationConfig({
  box,
  items,
  kitQuantity = 100,
  boxPersonalization,
  itemPersonalizations,
  onBoxPersonalizationChange,
  onItemPersonalizationChange,
}: PersonalizationConfigProps) {
  const totalPersonalizations =
    (boxPersonalization.enabled ? 1 : 0) +
    Object.values(itemPersonalizations).filter((p) => p.enabled).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Settings className="h-5 w-5" />
            Configurar Personalização
          </h3>
          <p className="text-sm text-muted-foreground">
            Escolha quais itens serão personalizados e configure a técnica de gravação
          </p>
        </div>

        {totalPersonalizations > 0 && (
          <Badge variant="default" className="text-sm">
            <Check className="mr-1 h-3 w-3" />
            {totalPersonalizations} {totalPersonalizations === 1 ? 'item' : 'itens'}{' '}
            personalizado(s)
          </Badge>
        )}
      </div>

      {/* Alerta de quantidade mínima */}
      {kitQuantity < 50 && totalPersonalizations > 0 && (
        <div className="flex items-center gap-2.5 rounded-lg border border-warning/20 bg-warning/10 p-3 text-sm">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 text-warning" />
          <div>
            <p className="font-medium text-warning">Quantidade baixa para personalização</p>
            <p className="text-xs text-muted-foreground">
              A maioria das técnicas de gravação exige lote mínimo de 50 unidades. Com {kitQuantity}{' '}
              {kitQuantity === 1 ? 'kit' : 'kits'}, o custo por unidade pode ser significativamente
              maior.
            </p>
          </div>
        </div>
      )}

      {/* Caixa */}
      {box && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Embalagem</h4>
          <ItemPersonalizationCard
            productId={box.id}
            displayName={box.name}
            imageUrl={box.imageUrl}
            personalization={boxPersonalization}
            onChange={onBoxPersonalizationChange}
            isBox
            kitQuantity={kitQuantity}
          />
        </div>
      )}

      {/* Itens */}
      {items.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">
            Itens do Kit ({items.length})
          </h4>
          <div className="space-y-3">
            {items.map((item) => (
              <ItemPersonalizationCard
                key={item.id}
                productId={item.id}
                displayName={item.name}
                imageUrl={item.imageUrl}
                personalization={itemPersonalizations[item.id] || { enabled: false }}
                onChange={(config) => onItemPersonalizationChange(item.id, config)}
                kitQuantity={kitQuantity}
              />
            ))}
          </div>
        </div>
      )}

      {items.length === 0 && !box && (
        <div className="py-12 text-center text-muted-foreground">
          <Palette className="mx-auto mb-3 h-12 w-12 opacity-50" />
          <p>Selecione uma caixa e itens para configurar a personalização</p>
        </div>
      )}
    </div>
  );
}
