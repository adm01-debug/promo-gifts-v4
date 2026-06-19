/**
 * Freight Estimator
 * Estimates shipping cost based on total weight
 * Tabela interna estimada — sem integração CEP real
 */

import { useState } from 'react';
import { Truck, AlertCircle, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatCurrency } from '@/lib/kit-builder';

interface FreightEstimatorProps {
  totalWeightGrams: number;
  kitQuantity: number;
}

// Tabela interna estimada por faixa de peso (SP Capital como referência)
const FREIGHT_TABLE = {
  sedex: [
    { maxKg: 1, price: 22.5 },
    { maxKg: 5, price: 35.0 },
    { maxKg: 10, price: 55.0 },
    { maxKg: 30, price: 95.0 },
    { maxKg: Infinity, price: 150.0 },
  ],
  pac: [
    { maxKg: 1, price: 15.0 },
    { maxKg: 5, price: 22.0 },
    { maxKg: 10, price: 35.0 },
    { maxKg: 30, price: 60.0 },
    { maxKg: Infinity, price: 95.0 },
  ],
  transportadora: [
    { maxKg: 5, price: 18.0 },
    { maxKg: 10, price: 28.0 },
    { maxKg: 30, price: 45.0 },
    { maxKg: 100, price: 80.0 },
    { maxKg: Infinity, price: 120.0 },
  ],
} as const;

const METHOD_LABELS: Record<string, string> = {
  sedex: 'SEDEX',
  pac: 'PAC',
  transportadora: 'Transportadora',
};

export function FreightEstimator({ totalWeightGrams, kitQuantity }: FreightEstimatorProps) {
  const [method, setMethod] = useState<string>('transportadora');

  const safeWeightGrams = Math.max(0, totalWeightGrams);
  const safeQuantity = Math.max(1, kitQuantity);
  const totalWeightKg = (safeWeightGrams * safeQuantity) / 1000;

  const table = FREIGHT_TABLE[method as keyof typeof FREIGHT_TABLE] || FREIGHT_TABLE.transportadora;
  const perShipmentCost =
    table.find((r) => totalWeightKg <= r.maxKg)?.price || table[table.length - 1].price;

  const noWeight = safeWeightGrams === 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Truck className="h-4 w-4 text-primary" />
          Estimativa de Frete
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 cursor-help text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">
                  Valores estimados com base em tabela interna (referência: SP Capital). Para
                  cotação exata, consulte sua transportadora com o CEP de destino.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {noWeight && (
          <div className="flex items-center gap-2 rounded-lg border border-warning/20 bg-warning/10 p-2.5 text-xs text-warning">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
            <span>Peso dos itens não informado. Estimativa pode ser imprecisa.</span>
          </div>
        )}

        <div className="space-y-1">
          <Label className="text-xs">Modalidade</Label>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sedex">SEDEX</SelectItem>
              <SelectItem value="pac">PAC</SelectItem>
              <SelectItem value="transportadora">Transportadora</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-secondary/50 p-2">
            <p className="text-[11px] text-muted-foreground">Peso Total</p>
            <p className="text-sm font-bold">{totalWeightKg.toFixed(1)}kg</p>
          </div>
          <div className="rounded-lg bg-secondary/50 p-2">
            <p className="text-[11px] text-muted-foreground">{METHOD_LABELS[method]}</p>
            <p className="text-sm font-bold text-primary">{formatCurrency(perShipmentCost)}</p>
          </div>
          <div className="rounded-lg bg-primary/10 p-2">
            <p className="text-[11px] text-muted-foreground">Por Kit</p>
            <p className="text-sm font-bold text-primary">
              {formatCurrency(perShipmentCost / safeQuantity)}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-1.5">
          <Badge variant="outline" className="gap-1 text-[10px] font-normal text-muted-foreground">
            <AlertCircle className="h-2.5 w-2.5" />
            Valores estimados — consulte transportadora para cotação exata
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
