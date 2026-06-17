import { useState, useMemo } from 'react';
import Fuse from 'fuse.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DollarSign,
  Loader2,
  Search,
  RotateCcw,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Palette,
  Ruler,
  Hash,
  Clock,
  Info,
} from 'lucide-react';
import { useTabelasPreco, useNomesTecnicasPreco, calcularPreco } from '@/hooks/simulation';
import type { TabelaPrecoTecnica, TabelaPrecoFiltros } from '@/types/tecnica-unificada';
import { cn } from '@/lib/utils';

export function PricingPanel() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTecnica, setFilterTecnica] = useState<string>('all');
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [simuladorQtd] = useState<Record<string, number>>({});

  // Construir filtros
  const filtros: TabelaPrecoFiltros = useMemo(() => {
    const f: TabelaPrecoFiltros = { apenasAtivas: true };
    if (filterTecnica !== 'all') f.nomeTecnica = filterTecnica;
    return f;
  }, [filterTecnica]);

  const { data: tabelas = [], isLoading, isError, error, refetch } = useTabelasPreco(filtros);
  const { data: nomesTecnicas = [] } = useNomesTecnicasPreco();

  // Fuse.js para busca fuzzy
  const tabelasFuse = useMemo(() => {
    return new Fuse(tabelas, {
      keys: [
        { name: 'nomeTecnica', weight: 0.5 },
        { name: 'codigoTabela', weight: 0.3 },
        { name: 'codigoTabelaOpcao', weight: 0.2 },
      ],
      threshold: 0.4,
      distance: 100,
      includeScore: true,
      minMatchCharLength: 2,
      ignoreLocation: true,
    });
  }, [tabelas]);

  // Agrupar tabelas por técnica
  const tabelasAgrupadas = useMemo(() => {
    let results = tabelas;

    // Aplicar busca fuzzy
    if (searchQuery && searchQuery.length >= 2) {
      const fuseResults = tabelasFuse.search(searchQuery);
      results = fuseResults.map((r) => r.item);
    }

    // Agrupar por nome da técnica
    const grupos: Record<string, TabelaPrecoTecnica[]> = {};
    results.forEach((tabela) => {
      if (!grupos[tabela.nomeTecnica]) {
        grupos[tabela.nomeTecnica] = [];
      }
      grupos[tabela.nomeTecnica].push(tabela);
    });

    // Ordenar cada grupo por maxCores
    Object.keys(grupos).forEach((key) => {
      grupos[key].sort((a, b) => (a.maxCores ?? 0) - (b.maxCores ?? 0));
    });

    return grupos;
  }, [tabelas, searchQuery, tabelasFuse]);

  const toggleExpand = (tecnicaNome: string) => {
    const newExpanded = new Set(expandedTables);
    if (newExpanded.has(tecnicaNome)) {
      newExpanded.delete(tecnicaNome);
    } else {
      newExpanded.add(tecnicaNome);
    }
    setExpandedTables(newExpanded);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getSimulacao = (tabela: TabelaPrecoTecnica) => {
    const qtd = simuladorQtd[tabela.id] || 100;
    return calcularPreco(tabela, qtd);
  };

  if (isError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="mb-4 h-12 w-12 text-destructive" />
          <p className="mb-2 text-lg font-medium text-destructive">Erro ao carregar tabelas</p>
          <p className="mb-4 max-w-md text-center text-sm text-muted-foreground">
            {error?.message || 'Não foi possível conectar ao banco de dados.'}
          </p>
          <Button onClick={() => refetch()} variant="outline">
            <RotateCcw className="mr-2 h-4 w-4" />
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Tabelas de Preços
            </CardTitle>
            <CardDescription>
              {isLoading ? 'Carregando...' : `${tabelas.length} tabelas de preço do banco externo`}
            </CardDescription>
          </div>
          <Button onClick={() => refetch()} variant="outline" size="sm" disabled={isLoading}>
            <RotateCcw className={cn('mr-2 h-4 w-4', isLoading && 'animate-spin')} />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filtros */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar tabelas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterTecnica} onValueChange={setFilterTecnica}>
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue placeholder="Filtrar por técnica" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as técnicas</SelectItem>
              {nomesTecnicas.map((nome) => (
                <SelectItem key={nome} value={nome}>
                  {nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Lista de Tabelas Agrupadas */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Carregando tabelas de preço...</p>
          </div>
        ) : Object.keys(tabelasAgrupadas).length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            Nenhuma tabela de preço encontrada
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(tabelasAgrupadas).map(([tecnicaNome, tabelasGrupo]) => (
              <Collapsible
                key={tecnicaNome}
                open={expandedTables.has(tecnicaNome)}
                onOpenChange={() => toggleExpand(tecnicaNome)}
              >
                <CollapsibleTrigger asChild>
                  <div className="flex cursor-pointer items-center justify-between rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50">
                    <div className="flex items-center gap-3">
                      {expandedTables.has(tecnicaNome) ? (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      )}
                      <div>
                        <h3 className="font-display font-semibold">{tecnicaNome}</h3>
                        <p className="text-sm text-muted-foreground">
                          {tabelasGrupo.length} tabela{tabelasGrupo.length > 1 ? 's' : ''} de preço
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {tabelasGrupo[0]?.precoPorCor && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Palette className="h-4 w-4 text-primary" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>Cobra por cor</TooltipContent>
                        </Tooltip>
                      )}
                      {tabelasGrupo[0]?.precoPorArea && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Ruler className="h-4 w-4 text-warning" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>Cobra por área</TooltipContent>
                        </Tooltip>
                      )}
                      {tabelasGrupo[0]?.precoPorPontos && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Hash className="h-4 w-4 text-primary" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>Cobra por pontos</TooltipContent>
                        </Tooltip>
                      )}
                      <Badge variant="secondary">
                        {tabelasGrupo.length} {tabelasGrupo.length > 1 ? 'variações' : 'variação'}
                      </Badge>
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 overflow-hidden rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-[140px]">Código</TableHead>
                          <TableHead className="text-center">Cores</TableHead>
                          <TableHead className="text-center">Dimensões</TableHead>
                          <TableHead className="text-right">Setup</TableHead>
                          <TableHead className="text-center">Faixas Qty</TableHead>
                          <TableHead className="text-right">Preço (100 un)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tabelasGrupo.map((tabela) => {
                          const simulacao = getSimulacao(tabela);
                          return (
                            <TableRow key={tabela.id}>
                              <TableCell>
                                <div className="flex flex-col">
                                  <Badge variant="outline" className="w-fit font-mono text-xs">
                                    {tabela.codigoTabelaOpcao}
                                  </Badge>
                                  {tabela.codigoServico && (
                                    <span className="mt-1 text-xs text-muted-foreground">
                                      Serv: {tabela.codigoServico}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                {tabela.maxCores ? (
                                  <Badge variant="secondary">{tabela.maxCores}</Badge>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {tabela.larguraMaxCm && tabela.alturaMaxCm ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="cursor-default text-sm">
                                        {tabela.larguraMaxCm}×{tabela.alturaMaxCm}cm
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      Área máxima: {tabela.larguraMaxCm}cm × {tabela.alturaMaxCm}cm
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {tabela.precoSetup > 0 ? formatCurrency(tabela.precoSetup) : '-'}
                              </TableCell>
                              <TableCell className="text-center">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span>
                                      <Badge variant="outline" className="cursor-default text-xs">
                                        {tabela.faixas.length} faixas
                                      </Badge>
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="space-y-1">
                                      {tabela.faixas.slice(0, 5).map((f) => (
                                        <div key={f.faixa} className="flex justify-between gap-4">
                                          <span>≥ {f.quantidadeMinima} un:</span>
                                          <span className="font-mono">
                                            {formatCurrency(f.precoUnitario)}
                                          </span>
                                        </div>
                                      ))}
                                      {tabela.faixas.length > 5 && (
                                        <div className="text-muted-foreground">
                                          +{tabela.faixas.length - 5} faixas...
                                        </div>
                                      )}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex flex-col items-end">
                                  <span className="font-mono font-semibold text-primary">
                                    {formatCurrency(simulacao.precoUnitario)}/un
                                  </span>
                                  {simulacao.slaDias && (
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <Clock className="h-3 w-3" />
                                      {simulacao.slaDias}d
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        )}

        {/* Legenda e Info */}
        <div className="mt-6 rounded-lg border bg-muted/50 p-4">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="text-sm text-muted-foreground">
              <p className="mb-1 font-medium text-foreground">Sobre as tabelas de preço</p>
              <ul className="list-inside list-disc space-y-1">
                <li>Os preços são importados da API do fornecedor (Stricker/Spot)</li>
                <li>Cada tabela possui 15 faixas de quantidade com preços escalonados</li>
                <li>O preço exibido é para 100 unidades como referência</li>
                <li>Setup é cobrado uma vez por pedido, independente da quantidade</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
