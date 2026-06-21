import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { GitBranch, GitCompare, Plus, Eye, Clock, FileText } from 'lucide-react';
import { QuoteVersionCompare } from './QuoteVersionCompare';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuoteVersions } from '@/hooks/quotes';
import { QUOTE_STATUS_CONFIG } from '@/lib/quote-status-config';
import { formatCurrency } from '@/lib/format';

interface QuoteVersionHistoryProps {
  quoteId: string;
  currentQuoteId: string;
  onCreateVersion?: () => void;
}

export function QuoteVersionHistory({
  quoteId,
  currentQuoteId,
  onCreateVersion,
}: QuoteVersionHistoryProps) {
  const navigate = useNavigate();
  const { versions, isLoading, fetchVersions, createNewVersion, hasMultipleVersions } =
    useQuoteVersions(quoteId);
  const [isCreating, setIsCreating] = useState(false);
  const [showCompare, setShowCompare] = useState(false);

  useEffect(() => {
    fetchVersions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteId]);

  const handleCreateVersion = async () => {
    setIsCreating(true);
    const newQuote = await createNewVersion(currentQuoteId);
    setIsCreating(false);
    if (newQuote?.id) {
      onCreateVersion?.();
      navigate(`/orcamentos/${newQuote.id}`);
    }
  };

  if (isLoading && versions.length === 0) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="animate-pulse space-y-2">
            <div className="h-4 w-1/3 rounded bg-muted" />
            <div className="h-8 rounded bg-muted" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <GitBranch className="h-4 w-4 text-primary" />
            Versões do Orçamento
            {hasMultipleVersions && (
              <Badge variant="secondary" className="text-xs">
                {versions.length} versões
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-1">
            {hasMultipleVersions && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowCompare(true)}
                    className="h-7 gap-1 text-xs"
                  >
                    <GitCompare className="h-3 w-3" />
                    Comparar
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Comparar versões lado a lado</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCreateVersion}
                  disabled={isCreating}
                  className="h-7 gap-1 text-xs"
                >
                  <Plus className="h-3 w-3" />
                  Nova Versão
                </Button>
              </TooltipTrigger>
              <TooltipContent>Criar nova versão baseada neste orçamento</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {versions.length <= 1 ? (
          <p className="text-xs text-muted-foreground">
            Este é o orçamento original (v1). Crie uma nova versão para registrar alterações.
          </p>
        ) : (
          <ScrollArea className="max-h-[280px]">
            <div className="space-y-2">
              {versions.map((version, idx) => {
                const isCurrent = version.id === currentQuoteId;
                const statusCfg =
                  QUOTE_STATUS_CONFIG[version.status as keyof typeof QUOTE_STATUS_CONFIG];

                return (
                  <div key={version.id}>
                    {idx > 0 && <Separator className="my-1" />}
                    <button
                      onClick={() => !isCurrent && navigate(`/orcamentos/${version.id}`)}
                      disabled={isCurrent}
                      className={`w-full rounded-md p-2 text-left transition-colors ${
                        isCurrent
                          ? 'border border-primary/20 bg-primary/10'
                          : 'cursor-pointer hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="font-mono text-xs font-bold text-primary">
                            v{version.version}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {version.quote_number}
                          </span>
                          {version.is_latest_version && (
                            <Badge variant="default" className="h-4 px-1 text-[10px]">
                              Atual
                            </Badge>
                          )}
                          {isCurrent && <Eye className="h-3 w-3 flex-shrink-0 text-primary" />}
                        </div>
                        <Badge
                          variant={
                            (statusCfg?.badgeVariant as
                              | 'default'
                              | 'destructive'
                              | 'outline'
                              | 'secondary') || 'secondary'
                          }
                          className="h-4 flex-shrink-0 px-1 text-[10px]"
                        >
                          {statusCfg?.label || version.status}
                        </Badge>
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Clock className="h-2.5 w-2.5" />
                          {format(new Date(version.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                            <FileText className="h-2.5 w-2.5" />
                            {version.items_count || 0} itens
                          </span>
                          <span className="text-xs font-medium">
                            {formatCurrency(version.total)}
                          </span>
                        </div>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>

      <QuoteVersionCompare
        open={showCompare}
        onOpenChange={setShowCompare}
        versions={versions}
        currentQuoteId={currentQuoteId}
      />
    </Card>
  );
}
