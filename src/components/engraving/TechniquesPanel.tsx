import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import {
  Settings,
  Search,
  Loader2,
  AlertCircle,
  Palette,
  Ruler,
  Hash,
  RotateCcw,
  Info,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { useTecnicasUnificadas, useCategoriasTecnicas } from '@/hooks/simulation';
import type { TecnicaUnificada, TecnicaFiltros } from '@/types/tecnica-unificada';
import { cn } from '@/lib/utils';

const CATEGORIA_LABELS: Record<string, string> = {
  impression: 'Impressão',
  engraving: 'Gravação',
  textile: 'Têxtil',
  embroidery: 'Bordado',
  transfer: 'Transfer',
} as const;

const CATEGORIA_COLORS: Record<string, string> = {
  impression: 'bg-info/10 text-info border-info/20',
  engraving: 'bg-warning/10 text-warning border-warning/20',
  textile: 'bg-primary/10 text-primary border-primary/20',
  embroidery: 'bg-primary/10 text-primary border-primary/20',
  transfer: 'bg-success/10 text-success border-success/20',
} as const;

export function TechniquesPanel() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategoria, setFilterCategoria] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Construir filtros
  const filtros: TecnicaFiltros = useMemo(() => {
    const f: TecnicaFiltros = {};
    if (filterStatus === 'ativas') f.apenasAtivas = true;
    if (filterCategoria !== 'all') f.categoria = filterCategoria;
    if (searchQuery.length >= 2) f.busca = searchQuery;
    return f;
  }, [searchQuery, filterCategoria, filterStatus]);

  const { tecnicas, isLoading, isError, error, refetch, toggleStatus, isToggling } =
    useTecnicasUnificadas(filtros);

  const categorias = useCategoriasTecnicas();

  const handleToggleActive = (tecnica: TecnicaUnificada) => {
    toggleStatus({ id: tecnica.id, ativo: !tecnica.ativo });
  };

  const getCategoriaLabel = (categoria: string) => CATEGORIA_LABELS[categoria] || categoria;

  const getCategoriaColor = (categoria: string) =>
    CATEGORIA_COLORS[categoria] || 'bg-muted text-muted-foreground';

  if (isError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="mb-4 h-12 w-12 text-destructive" />
          <p className="mb-2 text-lg font-medium text-destructive">Erro ao carregar técnicas</p>
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
              <Settings className="h-5 w-5 text-primary" />
              Técnicas de Personalização
            </CardTitle>
            <CardDescription>
              {isLoading
                ? 'Carregando...'
                : `${tecnicas.length} técnicas encontradas no banco externo`}
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
              placeholder="Buscar técnicas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterCategoria} onValueChange={setFilterCategoria}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {categorias.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {getCategoriaLabel(cat)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ativas">Apenas ativas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabela */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="text-center">Categoria</TableHead>
                <TableHead className="text-center">Cobrança</TableHead>
                <TableHead className="text-center">Cores</TableHead>
                <TableHead className="text-center">Curva</TableHead>
                <TableHead className="text-center">Ativa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">Carregando técnicas...</p>
                  </TableCell>
                </TableRow>
              ) : tecnicas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                    Nenhuma técnica encontrada
                  </TableCell>
                </TableRow>
              ) : (
                tecnicas.map((tecnica) => (
                  <TableRow key={tecnica.id} className={!tecnica.ativo ? 'opacity-50' : ''}>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {tecnica.codigo}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{tecnica.nome}</span>
                        {tecnica.descricao && (
                          <span className="line-clamp-1 text-xs text-muted-foreground">
                            {tecnica.descricao}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={getCategoriaColor(tecnica.categoria)} variant="outline">
                        {getCategoriaLabel(tecnica.categoria)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {tecnica.precoPorCor && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Palette className="h-4 w-4 text-primary" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Por Cor</TooltipContent>
                          </Tooltip>
                        )}
                        {tecnica.precoPorArea && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Ruler className="h-4 w-4 text-warning" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Por Área</TooltipContent>
                          </Tooltip>
                        )}
                        {tecnica.precoPorPontos && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Hash className="h-4 w-4 text-primary" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Por Pontos</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {tecnica.permiteCores ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Badge variant="secondary" className="cursor-default text-xs">
                                {tecnica.minCores}-{tecnica.maxCores}
                              </Badge>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            De {tecnica.minCores} a {tecnica.maxCores} cores
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-xs text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {tecnica.aplicaSuperficieCurva ? (
                        <CheckCircle className="mx-auto h-4 w-4 text-success" />
                      ) : (
                        <XCircle className="mx-auto h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={tecnica.ativo}
                        onCheckedChange={() => handleToggleActive(tecnica)}
                        disabled={isToggling}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Legenda */}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="font-medium">Legenda:</span>
          <div className="flex items-center gap-1">
            <Palette className="h-3 w-3 text-primary" />
            <span>Por Cor</span>
          </div>
          <div className="flex items-center gap-1">
            <Ruler className="h-3 w-3 text-warning" />
            <span>Por Área</span>
          </div>
          <div className="flex items-center gap-1">
            <Hash className="h-3 w-3 text-primary" />
            <span>Por Pontos</span>
          </div>
          <div className="flex items-center gap-1">
            <Info className="h-3 w-3" />
            <span>Dados do banco externo (somente leitura)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
