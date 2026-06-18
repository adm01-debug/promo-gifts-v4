import { dbInvoke } from '@/lib/db/postgrest';
import { type ExternalTechnique } from '@/types/external-db';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Clock,
  Palette,
  Info,
  ChevronDown,
  ChevronUp,
  Zap,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Technique {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  setup_cost: number | null;
  unit_cost: number | null;
  min_quantity: number | null;
  estimated_days: number | null;
  is_active: boolean;
}

interface TechniqueSLACardProps {
  productId?: string;
  onSelectTechnique?: (technique: Technique) => void;
  selectedTechniqueId?: string;
  quantity?: number;
  className?: string;
}

function getSLAColor(days: number | null): { color: string; label: string; icon: React.ReactNode } {
  if (!days)
    return { color: 'bg-muted', label: 'Não informado', icon: <Info className="h-3 w-3" /> };
  if (days <= 3)
    return { color: 'bg-primary', label: 'Entrega Rápida', icon: <Zap className="h-3 w-3" /> };
  if (days <= 7)
    return { color: 'bg-warning', label: 'Prazo Normal', icon: <Clock className="h-3 w-3" /> };
  return {
    color: 'bg-destructive',
    label: 'Prazo Estendido',
    icon: <AlertTriangle className="h-3 w-3" />,
  };
}

function formatCurrency(value: number | null): string {
  if (!value) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function calculateTotalCost(technique: Technique, quantity: number): number {
  const setup = technique.setup_cost ?? 0;
  const unit = technique.unit_cost ?? 0;
  return setup + unit * quantity;
}

export function TechniqueSLACard({
  productId,
  onSelectTechnique,
  selectedTechniqueId,
  quantity = 100,
  className,
}: TechniqueSLACardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [sortBy, setSortBy] = useState<'sla' | 'cost'>('sla');

  const { data: techniques, isLoading } = useQuery({
    queryKey: ['techniques-sla-external', productId],
    queryFn: async () => {
      const result = await dbInvoke<Technique>({
        table: 'personalization_techniques',
        operation: 'select',
        filters: { is_active: true },
        orderBy: { column: 'estimated_days', ascending: true },
        limit: 100,
      });
      return result.records.map((t) => {
        const ext = t as Technique & Pick<ExternalTechnique, 'setup_price' | 'handling_price'>;
        return {
          ...t,
          setup_cost: ext.setup_price ?? t.setup_cost,
          unit_cost: ext.handling_price ?? t.unit_cost,
        };
      });
    },
  });

  const sortedTechniques = techniques?.slice().sort((a, b) => {
    if (sortBy === 'sla') {
      return (a.estimated_days || 999) - (b.estimated_days || 999);
    }
    return calculateTotalCost(a, quantity) - calculateTotalCost(b, quantity);
  });

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!techniques?.length) {
    return (
      <Card className={className}>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <Palette className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p>Nenhuma técnica disponível</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Palette className="h-5 w-5 text-primary" />
              Técnicas de Gravação
            </CardTitle>
            <CardDescription>
              Selecione a técnica de personalização com base no prazo e custo
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg bg-muted p-1">
              <Button
                variant={sortBy === 'sla' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setSortBy('sla')}
              >
                <Clock className="mr-1 h-3 w-3" />
                Prazo
              </Button>
              <Button
                variant={sortBy === 'cost' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setSortBy('cost')}
              >
                <DollarSign className="mr-1 h-3 w-3" />
                Custo
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)}>
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-3">
          {sortedTechniques?.map((technique) => {
            const sla = getSLAColor(technique.estimated_days);
            const isSelected = selectedTechniqueId === technique.id;
            const totalCost = calculateTotalCost(technique, quantity);
            const minQtyMet = !technique.min_quantity || quantity >= technique.min_quantity;

            return (
              <TooltipProvider key={technique.id}>
                <div
                  className={cn(
                    'relative cursor-pointer rounded-lg border p-4 transition-all hover:shadow-md',
                    isSelected
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border hover:border-primary/50',
                    !minQtyMet && 'opacity-60',
                  )}
                  onClick={() => minQtyMet && onSelectTechnique?.(technique)}
                >
                  {isSelected && (
                    <div className="absolute right-2 top-2">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <h4 className="font-semibold text-foreground">{technique.name}</h4>
                        {technique.code && (
                          <Badge variant="outline" className="font-mono text-xs">
                            {technique.code}
                          </Badge>
                        )}
                      </div>

                      {technique.description && (
                        <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">
                          {technique.description}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="secondary"
                              className={cn('gap-1', sla.color, 'text-primary-foreground')}
                            >
                              {sla.icon}
                              {technique.estimated_days
                                ? `${technique.estimated_days} dias`
                                : 'N/A'}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Prazo estimado de produção: {sla.label}</p>
                          </TooltipContent>
                        </Tooltip>

                        {technique.min_quantity && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                className={cn(
                                  'flex items-center gap-1 text-muted-foreground',
                                  !minQtyMet && 'text-destructive',
                                )}
                              >
                                <Package className="h-3 w-3" />
                                Mín. {technique.min_quantity} un.
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                {minQtyMet
                                  ? 'Quantidade mínima atendida'
                                  : `Quantidade mínima não atingida (${quantity}/${technique.min_quantity})`}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="text-lg font-bold text-foreground">
                        {formatCurrency(totalCost)}
                      </div>
                      <div className="text-xs text-muted-foreground">p/ {quantity} un.</div>
                      {technique.setup_cost ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Setup: {formatCurrency(technique.setup_cost)}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {technique.estimated_days && (
                    <div className="mt-3">
                      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                        <span>SLA de Entrega</span>
                        <span>{sla.label}</span>
                      </div>
                      <Progress
                        value={Math.max(10, 100 - technique.estimated_days * 10)}
                        className="h-1.5"
                      />
                    </div>
                  )}
                </div>
              </TooltipProvider>
            );
          })}

          <div className="border-t pt-2">
            <p className="text-center text-xs text-muted-foreground">
              💡 Dica: Técnicas com menor prazo podem ter custo adicional para produção expressa
            </p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
