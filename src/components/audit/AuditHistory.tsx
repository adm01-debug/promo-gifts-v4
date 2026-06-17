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
    <div className="flex flex-wrap items-center gap-1 py-1 text-sm">
      <span className="font-medium text-muted-foreground">{label}:</span>
      <span className="text-destructive line-through">{formatFieldValue(oldValue)}</span>
      <span className="text-muted-foreground">→</span>
      <span className="font-medium text-success">{formatFieldValue(newValue)}</span>
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="h-5 w-5" />
          {title}
          <Badge variant="outline" className="ml-2">
            {history.length} {history.length === 1 ? 'registro' : 'registros'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea style={{ maxHeight }}>
          <div className="divide-y">
            {history.map((log) => {
              const config =
                actionConfig[log.action as keyof typeof actionConfig] || actionConfig.UPDATE;
              const Icon = config.icon;
              const isExpanded = expandedItems.has(log.id);
              const hasDetails = log.action === 'UPDATE' && log.old_values && log.new_values;

              return (
                <Collapsible
                  key={log.id}
                  open={isExpanded}
                  onOpenChange={() => hasDetails && toggleExpanded(log.id)}
                >
                  <div className="p-4 transition-colors hover:bg-muted/50">
                    <div className="flex items-start gap-3">
                      {/* Avatar/Icon */}
                      <div
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-full border',
                          config.className,
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={config.className}>
                            {config.label}
                          </Badge>
                          <span className="text-sm text-muted-foreground">por</span>
                          <span className="flex items-center gap-1 text-sm font-medium">
                            <User className="h-3 w-3" />
                            {log.profiles?.full_name || log.profiles?.email || 'Sistema'}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {format(new Date(log.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", {
                            locale: ptBR,
                          })}
                        </p>

                        {/* Expand trigger for UPDATE */}
                        {hasDetails && (
                          <CollapsibleTrigger asChild>
                            <button
                              className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline"
                              aria-label="Avançar"
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

                        {/* Details for INSERT */}
                        {log.action === 'INSERT' && log.new_values && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            Registro criado com {Object.keys(log.new_values).length} campos
                          </div>
                        )}

                        {/* Details for DELETE */}
                        {log.action === 'DELETE' && (
                          <div className="mt-2 text-xs text-destructive">
                            Registro excluído permanentemente
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Expanded details for UPDATE */}
                    <CollapsibleContent>
                      {hasDetails && (
                        <div className="ml-13 mt-3 border-l-2 border-muted pl-4">
                          {Object.keys(log.new_values ?? {}).map((field) => (
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
                </Collapsible>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
