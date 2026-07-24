import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, User, FileEdit, Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

import { fetchAuditHistory, type AuditEntityType } from '@/hooks/admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { TimelineDot, TimelineLine } from '@/components/ui/timeline';
import { cn } from '@/lib/utils';

interface AuditHistoryProps {
  entityType: AuditEntityType;
  entityId: string;
  title?: string;
  maxHeight?: string;
}

const actionConfig = {
  INSERT: {
    label: 'Criação',
    icon: Plus,
    variant: 'default' as const,
    className: 'bg-success/10 text-success border-success/20',
  },
  UPDATE: {
    label: 'Edição',
    icon: FileEdit,
    variant: 'secondary' as const,
    className: 'bg-info/10 text-info border-info/20',
  },
  DELETE: {
    label: 'Exclusão',
    icon: Trash2,
    variant: 'destructive' as const,
    className: 'bg-destructive/10 text-destructive border-destructive/20',
  },
};

const fieldLabels: Record<string, string> = {
  name: 'Nome',
  description: 'Descrição',
  price: 'Preço',
  cost_price: 'Preço de Custo',
  min_quantity: 'Qtd. Mínima',
  is_active: 'Ativo',
  featured: 'Destaque',
  stock: 'Estoque',
  sku: 'SKU',
  category_name: 'Categoria',
  supplier_id: 'Fornecedor',
  colors: 'Cores',
  materials: 'Materiais',
  images: 'Imagens',
  status: 'Status',
  total: 'Total',
  discount_percent: 'Desconto (%)',
  notes: 'Observações',
};

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'number') {
    // Se parece ser um preço
    if (value > 0 && value < 1000000) {
      return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    }
    return value.toString();
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '—';
    return value.length > 3
      ? `${value.slice(0, 3).join(', ')} +${value.length - 3}`
      : value.join(', ');
  }
  if (typeof value === 'object') {
    return `${JSON.stringify(value).substring(0, 50)}...`;
  }
  return String(value);
}

function FieldChange({
  field,
  oldValue,
  newValue,
}: {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}) {
  const label = fieldLabels[field] || field;

  return (
    <div className="flex flex-wrap items-center gap-1.5 py-0.5 text-[11px] sm:text-xs">
      <span className="font-medium text-muted-foreground">{label}:</span>
      <span className="break-all text-destructive/90 line-through">{formatFieldValue(oldValue)}</span>
      <span className="text-muted-foreground/70">→</span>
      <span className="break-all font-medium text-success">{formatFieldValue(newValue)}</span>
    </div>
  );
}

export function AuditHistory({
  entityType,
  entityId,
  title = 'Histórico de Alterações',
  maxHeight = '400px',
}: AuditHistoryProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const { data: history, isLoading } = useQuery({
    queryKey: ['audit-history', entityType, entityId],
    queryFn: () => fetchAuditHistory(entityType, entityId),
    enabled: !!entityId,
  });

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!history || history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-4 text-center text-sm text-muted-foreground">
            Nenhum registro de alteração encontrado.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/40 bg-card/40 backdrop-blur-sm">
      <CardHeader className="border-b border-border/40 pb-3 sm:pb-4">
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm font-semibold sm:text-base">
          <Clock className="h-4 w-4 text-primary" aria-hidden="true" />
          {title}
          <Badge
            variant="outline"
            className="ml-auto border-border/40 bg-muted/40 text-[10px] font-normal sm:text-xs"
          >
            {history.length} {history.length === 1 ? 'registro' : 'registros'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea style={{ maxHeight }}>
          <div className="relative px-3 py-3 sm:px-4 sm:py-4">
            <TimelineLine
              topClassName="top-4"
              bottomClassName="bottom-4"
              leftClassName="left-[27px] sm:left-[31px]"
            />

            <ol className="space-y-1">
              {history.map((log, index) => {
                const config =
                  actionConfig[log.action as keyof typeof actionConfig] || actionConfig.UPDATE;
                const Icon = config.icon;
                const isExpanded = expandedItems.has(log.id);
                const hasDetails = log.action === 'UPDATE' && log.old_values && log.new_values;
                const isFirst = index === 0;

                return (
                  <Collapsible
                    key={log.id}
                    open={isExpanded}
                    onOpenChange={() => hasDetails && toggleExpanded(log.id)}
                  >
                    <li className="group relative pl-10 sm:pl-12">
                      <TimelineDot
                        highlighted={isFirst}
                        toneClassName={config.className}
                        className="absolute left-0 top-2 h-7 w-7 sm:h-8 sm:w-8"
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </TimelineDot>


                      {/* Card sutil ao redor do conteúdo */}
                      <div
                        className={cn(
                          'rounded-lg border border-transparent px-2.5 py-2 transition-all duration-200 sm:px-3',
                          'group-hover:border-border/40 group-hover:bg-card/60',
                        )}
                      >
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className={cn(config.className, 'text-[10px] font-medium sm:text-xs')}
                          >
                            {config.label}
                          </Badge>
                          <span className="hidden text-xs text-muted-foreground sm:inline">
                            por
                          </span>
                          <span className="flex min-w-0 items-center gap-1 text-xs font-medium">
                            <User className="h-3 w-3 shrink-0" aria-hidden="true" />
                            <span className="truncate">
                              {log.profiles?.full_name || log.profiles?.email || 'Sistema'}
                            </span>
                          </span>
                        </div>
                        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground/80">
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          <time dateTime={log.created_at}>
                            <span className="sm:hidden">
                              {format(new Date(log.created_at), "dd/MM 'às' HH:mm", {
                                locale: ptBR,
                              })}
                            </span>
                            <span className="hidden sm:inline">
                              {format(
                                new Date(log.created_at),
                                "dd 'de' MMMM 'de' yyyy 'às' HH:mm",
                                { locale: ptBR },
                              )}
                            </span>
                          </time>
                        </p>

                        {hasDetails && (
                          <CollapsibleTrigger asChild>
                            <button
                              type="button"
                              className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary transition-colors hover:text-primary/80"
                              aria-label={isExpanded ? 'Ocultar detalhes' : 'Ver campos alterados'}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-3 w-3" />
                              ) : (
                                <ChevronRight className="h-3 w-3" />
                              )}
                              {isExpanded ? 'Ocultar detalhes' : 'Ver campos alterados'}
                            </button>
                          </CollapsibleTrigger>
                        )}

                        {log.action === 'INSERT' && log.new_values && (
                          <p className="mt-1.5 text-[11px] text-muted-foreground">
                            Registro criado com {Object.keys(log.new_values).length} campos
                          </p>
                        )}

                        {log.action === 'DELETE' && (
                          <p className="mt-1.5 text-[11px] text-destructive/90">
                            Registro excluído permanentemente
                          </p>
                        )}

                        <CollapsibleContent>
                          {hasDetails && (
                            <div className="mt-2.5 space-y-0.5 rounded-md border border-border/40 bg-muted/30 px-2.5 py-2">
                              {Object.keys(log.new_values || {}).map((field) => (
                                <FieldChange
                                  key={field}
                                  field={field}
                                  oldValue={log.old_values?.[field]}
                                  newValue={log.new_values?.[field]}
                                />
                              ))}
                            </div>
                          )}
                        </CollapsibleContent>
                      </div>
                    </li>
                  </Collapsible>
                );
              })}
            </ol>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
