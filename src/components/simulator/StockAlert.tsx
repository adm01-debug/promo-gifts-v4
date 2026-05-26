// src/components/simulator/StockAlert.tsx
// Melhoria #7: Alertas de estoque/disponibilidade

import { useMemo } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, PackageX, Package, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import type { Product } from '@/types/simulation';

interface StockInfo {
  available: number;
  reserved: number;
  status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'unknown';
}

interface StockAlertProps {
  product: Product | undefined;
  quantity: number;
  className?: string;
}

// Simula informação de estoque (em produção, viria da API Promobrind)
function getStockInfo(product: Product | undefined): StockInfo {
  if (!product) {
    return { available: 0, reserved: 0, status: 'unknown' };
  }

  // Simulação baseada em padrões do produto
  // Em produção, isso viria de uma API real
  const hash = product.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const baseStock = (hash % 500) + 50;
  const reserved = Math.floor(baseStock * 0.1);
  const available = baseStock - reserved;

  let status: StockInfo['status'] = 'in_stock';
  if (available <= 0) status = 'out_of_stock';
  else if (available < 100) status = 'low_stock';

  return { available, reserved, status };
}

export function StockAlert({ product, quantity, className }: StockAlertProps) {
  const stockInfo = useMemo(() => getStockInfo(product), [product]);

  const alertLevel = useMemo(() => {
    if (stockInfo.status === 'unknown') return 'unknown';
    if (stockInfo.status === 'out_of_stock') return 'critical';
    if (quantity > stockInfo.available) return 'warning';
    if (stockInfo.status === 'low_stock') return 'caution';
    return 'ok';
  }, [stockInfo, quantity]);

  const shortfall = useMemo(() => {
    if (alertLevel === 'warning') {
      return quantity - stockInfo.available;
    }
    return 0;
  }, [alertLevel, quantity, stockInfo.available]);

  // Não mostrar alerta se estoque OK ou desconhecido
  if (alertLevel === 'ok' || alertLevel === 'unknown') {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={className}
    >
      <Alert
        variant={alertLevel === 'critical' ? 'destructive' : 'default'}
        className={cn(
          alertLevel === 'warning' && 'border-warning/50 bg-warning/10',
          alertLevel === 'caution' && 'border-warning/30 bg-warning/5',
        )}
      >
        {alertLevel === 'critical' ? (
          <PackageX className="h-4 w-4" />
        ) : (
          <AlertTriangle className="h-4 w-4" />
        )}
        <AlertTitle className="flex items-center gap-2">
          {alertLevel === 'critical' && 'Produto sem estoque'}
          {alertLevel === 'warning' && 'Estoque insuficiente'}
          {alertLevel === 'caution' && 'Estoque baixo'}
        </AlertTitle>
        <AlertDescription className="mt-1 space-y-2">
          {alertLevel === 'critical' && (
            <p>Este produto está indisponível no momento. Entre em contato com o fornecedor.</p>
          )}
          {alertLevel === 'warning' && (
            <>
              <p>
                Disponível: <strong>{stockInfo.available}</strong> unidades. Você precisa de mais{' '}
                <strong>{shortfall}</strong> unidades.
              </p>
              <p className="text-xs opacity-80">
                Considere reduzir a quantidade ou consultar previsão de reposição.
              </p>
            </>
          )}
          {alertLevel === 'caution' && (
            <p>
              Estoque limitado: <strong>{stockInfo.available}</strong> unidades disponíveis.
              Confirme disponibilidade antes de fechar o pedido.
            </p>
          )}
        </AlertDescription>
      </Alert>
    </motion.div>
  );
}

// Badge compacto para exibição em lista
export function StockBadge({ product, quantity, className }: StockAlertProps) {
  const stockInfo = useMemo(() => getStockInfo(product), [product]);

  const alertLevel = useMemo(() => {
    if (stockInfo.status === 'unknown') return 'unknown';
    if (stockInfo.status === 'out_of_stock') return 'critical';
    if (quantity > stockInfo.available) return 'warning';
    if (stockInfo.status === 'low_stock') return 'caution';
    return 'ok';
  }, [stockInfo, quantity]);

  if (alertLevel === 'unknown') return null;

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              'cursor-help gap-1 text-[10px]',
              alertLevel === 'ok' && 'border-success/30 bg-success/10 text-success',
              alertLevel === 'caution' && 'border-warning/30 bg-warning/10 text-warning',
              alertLevel === 'warning' && 'border-warning/40 bg-warning/15 text-warning',
              alertLevel === 'critical' &&
                'border-destructive/30 bg-destructive/10 text-destructive',
              className,
            )}
          >
            {alertLevel === 'ok' && <CheckCircle2 className="h-3 w-3" />}
            {alertLevel === 'caution' && <Info className="h-3 w-3" />}
            {alertLevel === 'warning' && <AlertTriangle className="h-3 w-3" />}
            {alertLevel === 'critical' && <PackageX className="h-3 w-3" />}

            {alertLevel === 'ok' && `${stockInfo.available} un`}
            {alertLevel === 'caution' && 'Estoque baixo'}
            {alertLevel === 'warning' && 'Verificar'}
            {alertLevel === 'critical' && 'Sem estoque'}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 font-medium">
              <Package className="h-3.5 w-3.5" />
              Estoque: {stockInfo.available} disponíveis
            </p>
            {stockInfo.reserved > 0 && (
              <p className="text-xs text-muted-foreground">
                {stockInfo.reserved} unidades reservadas
              </p>
            )}
            {quantity > stockInfo.available && (
              <p className="text-xs text-destructive">
                Faltam {quantity - stockInfo.available} unidades
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
