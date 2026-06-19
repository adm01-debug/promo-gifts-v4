/**
 * ConfigurationPanel — Etapa 4: Configurar tamanho, cores e calcular preço
 *
 * Verifica se a tabela de preço usa faixas dimensionais (Laser).
 * Se sim, mostra inputs de largura/altura.
 * Se cobra_por_cor, mostra seletor de cores.
 * Calcula preço somente quando todos os campos obrigatórios estão preenchidos.
 */

import { dbInvoke } from '@/lib/db/postgrest';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Loader2, Palette, Clock, Ruler, AlertCircle, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { invokeExternalRpc } from '@/lib/external-rpc';
import type {
  PrintAreaV2,
  CustomizationPriceResponse,
  CustomizationPriceFlat,
} from '@/hooks/simulation';
import { adaptPriceResponse } from '@/lib/personalization/adapters';

interface ConfigurationPanelProps {
  area: PrintAreaV2;
  quantity: number;
  onPriceCalculated: (areaId: string, priceData: CustomizationPriceFlat | null) => void;
}

interface FaixaDimensional {
  largura_min: number | null;
  largura_max: number | null;
  altura_min: number | null;
  altura_max: number | null;
}

export function ConfigurationPanel({ area, quantity, onPriceCalculated }: ConfigurationPanelProps) {
  // Dimension state
  const [usaDimensao, setUsaDimensao] = useState<boolean | null>(null);
  const [checkingDimensao, setCheckingDimensao] = useState(true);
  const [largura, setLargura] = useState<string>('');
  const [altura, setAltura] = useState<string>('');

  // Color state
  const [numCores, setNumCores] = useState(1);

  // Price state
  const [priceData, setPriceData] = useState<CustomizationPriceFlat | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showColorSelector = area.cobra_por_cor && (area.max_colors ?? 1) > 1;
  const maxColors = area.max_colors ?? 1;

  // Check if the price table uses dimensional pricing
  useEffect(() => {
    let cancelled = false;
    setCheckingDimensao(true);
    setUsaDimensao(null);
    setPriceData(null);
    setLargura('');
    setAltura('');
    setNumCores(1);
    setError(null);

    (async () => {
      try {
        const result = await dbInvoke<FaixaDimensional>({
          table: 'tabela_preco_gravacao_oficial_faixa',
          operation: 'select',
          select: 'largura_min, largura_max, altura_min, altura_max',
          filters: { tabela_preco_gravacao_id: area.customization_price_table_id ?? '' },
          limit: 1,
        });
        if (cancelled) return;

        const faixa = result.records[0];
        const hasDimension = !!(faixa && faixa.largura_min !== null);
        setUsaDimensao(hasDimension);
      } catch {
        if (!cancelled) setUsaDimensao(false);
      } finally {
        if (!cancelled) setCheckingDimensao(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [area.area_id, area.customization_price_table_id]);

  // Determine if we can calculate price
  const larguraNum = parseFloat(largura) || 0;
  const alturaNum = parseFloat(altura) || 0;

  const canCalculate = useMemo(() => {
    if (quantity <= 0) return false;
    if (usaDimensao === null) return false;
    if (usaDimensao) {
      return (
        larguraNum > 0 &&
        alturaNum > 0 &&
        larguraNum <= area.max_width &&
        alturaNum <= area.max_height
      );
    }
    return true; // No dimension needed
  }, [quantity, usaDimensao, larguraNum, alturaNum, area.max_width, area.max_height]);

  // Calculate price when inputs are valid
  const calculatePrice = useCallback(async () => {
    if (!canCalculate) return;
    setLoading(true);
    setError(null);

    try {
      const result = await invokeExternalRpc<CustomizationPriceResponse>(
        'fn_get_customization_price',
        {
          p_area_id: area.area_id,
          p_quantidade: quantity,
          p_num_cores: numCores,
          p_largura_cm: usaDimensao ? larguraNum : null,
          p_altura_cm: usaDimensao ? alturaNum : null,
        },
      );

      if (result?.success) {
        const flat = adaptPriceResponse(result);
        setPriceData(flat);
        onPriceCalculated(area.area_id, flat);
      } else {
        setPriceData(null);
        setError('Erro no cálculo de preço');
        onPriceCalculated(area.area_id, null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao calcular preço');
      setPriceData(null);
      onPriceCalculated(area.area_id, null);
    } finally {
      setLoading(false);
    }
  }, [
    canCalculate,
    area.area_id,
    quantity,
    numCores,
    usaDimensao,
    larguraNum,
    alturaNum,
    onPriceCalculated,
  ]);

  const calculatePriceRef = useRef(calculatePrice);
  calculatePriceRef.current = calculatePrice;
  const onPriceCalculatedRef = useRef(onPriceCalculated);
  onPriceCalculatedRef.current = onPriceCalculated;

  // Auto-calculate when inputs change
  useEffect(() => {
    if (canCalculate) {
      const timer = setTimeout(() => calculatePriceRef.current(), 400);
      return () => clearTimeout(timer);
    }
    setPriceData(null);
    onPriceCalculatedRef.current(area.area_id, null);
    return undefined;
  }, [canCalculate, numCores, larguraNum, alturaNum, quantity, area.area_id]);

  if (checkingDimensao) {
    return (
      <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Carregando configuração...
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-border/50 bg-secondary/30 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Etapa 4 · Configure a gravação
      </p>

      {/* Dimension inputs (only for dimensional tables like Laser) */}
      {usaDimensao && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-sm text-foreground">
            <Ruler className="h-3.5 w-3.5" />
            <span className="font-medium">Tamanho da gravação</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Informe o tamanho desejado (máx. {area.max_width}×{area.max_height}cm)
          </p>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">Largura (cm)</Label>
              <Input
                type="number"
                step="0.1"
                min="0.1"
                max={area.max_width}
                value={largura}
                onChange={(e) => setLargura(e.target.value)}
                placeholder={`até ${area.max_width}`}
                className="h-9 text-sm"
              />
            </div>
            <span className="mt-5 text-muted-foreground">×</span>
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">Altura (cm)</Label>
              <Input
                type="number"
                step="0.1"
                min="0.1"
                max={area.max_height}
                value={altura}
                onChange={(e) => setAltura(e.target.value)}
                placeholder={`até ${area.max_height}`}
                className="h-9 text-sm"
              />
            </div>
          </div>
          {(larguraNum > area.max_width || alturaNum > area.max_height) && (
            <div className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3 w-3" />
              Excede o limite da área ({area.max_width}×{area.max_height}cm)
            </div>
          )}
        </div>
      )}

      {/* Color selector */}
      {showColorSelector && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-sm text-foreground">
            <Palette className="h-3.5 w-3.5" />
            <span className="font-medium">Nº de cores</span>
          </div>
          <div className="flex gap-1.5">
            {Array.from({ length: maxColors }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                className={cn(
                  'h-9 w-9 rounded-md text-sm font-medium transition-colors',
                  n === numCores
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
                )}
                onClick={() => setNumCores(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Not charging by color? Show info */}
      {!area.cobra_por_cor && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Palette className="h-3 w-3" />
          {maxColors === 1 ? '1 cor (fixa)' : 'Full Color — sem limite de cores'}
        </div>
      )}

      {/* Price result */}
      {loading && (
        <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Calculando preço...
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </div>
      )}

      {priceData && !loading && (
        <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
          {/* Redirect notice */}
          {priceData.redirected_from && priceData.redirected_to && (
            <div className="flex items-center gap-1.5 rounded-md border border-warning/20 bg-warning/10 p-2 text-xs text-warning">
              <AlertCircle className="h-3 w-3 flex-shrink-0" />
              <span>
                Redirecionado automaticamente: as dimensões excedem o limite da técnica original.
                Usando <strong>{priceData.technique}</strong> (compatível com o formato do produto).
              </span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">{priceData.technique}</span>
          </div>

          <div className="space-y-0.5 text-xs text-muted-foreground">
            {usaDimensao && larguraNum > 0 && alturaNum > 0 && (
              <p>
                Gravação: {larguraNum} × {alturaNum} cm
              </p>
            )}
            <p>Quantidade: {quantity} peças</p>
            {priceData.num_cores > 1 && <p>Cores: {priceData.num_cores}</p>}
          </div>

          <div className="space-y-1 border-t border-border/50 pt-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Preço unitário:</span>
              <span className="font-semibold text-primary">
                R$ {priceData.unit_price?.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal gravação:</span>
              <span className="font-medium text-foreground">
                R$ {priceData.total_price?.toFixed(2)}
              </span>
            </div>
            {priceData.minimum_applied && (
              <div className="flex items-center gap-1.5 text-xs text-warning">
                <AlertCircle className="h-3 w-3" />
                Faturamento mínimo aplicado
              </div>
            )}
            {priceData.production_days && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                Prazo: {priceData.production_days} dias úteis
              </div>
            )}
          </div>
        </div>
      )}

      {/* Waiting for inputs */}
      {!canCalculate && !loading && !priceData && (
        <div className="rounded-lg bg-muted/30 p-3 text-center text-xs text-muted-foreground">
          {usaDimensao
            ? 'Preencha largura e altura para calcular o preço'
            : 'Aguardando configuração...'}
        </div>
      )}
    </div>
  );
}
