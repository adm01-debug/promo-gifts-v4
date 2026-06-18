/**
 * TrendsCharts — Chart and list sections extracted from TrendsPage
 */
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Eye,
  Search,
  Package,
  BarChart3,
  FileText,
  ExternalLink,
  TrendingUp,
  Sparkles,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { useNavigate } from 'react-router-dom';

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
};

interface TrendProduct {
  id?: string | null;
  name?: string | null;
  sku?: string | null;
  views?: number | null;
  compares?: number | null;
  trendingScore?: number | null;
  classification?: string | null;
}

interface TrendSearch {
  term?: string | null;
  count?: number | null;
  avgResults?: number | null;
}

interface ActivityChartProps {
  dailyTrends: Record<string, unknown>[] | undefined;
  isLoading: boolean;
}

export function ActivityChart({ dailyTrends, isLoading }: ActivityChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Atividade ao Longo do Tempo
        </CardTitle>
        <CardDescription>Visualizações e buscas por dia</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : dailyTrends?.length ? (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={dailyTrends}>
              <defs>
                <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorSearches" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="dateLabel" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip contentStyle={tooltipStyle} />
              <Area
                type="monotone"
                dataKey="views"
                name="Visualizações"
                stroke="hsl(var(--primary))"
                fillOpacity={1}
                fill="url(#colorViews)"
              />
              <Area
                type="monotone"
                dataKey="searches"
                name="Buscas"
                stroke="hsl(var(--chart-2))"
                fillOpacity={1}
                fill="url(#colorSearches)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">
            <div className="text-center">
              <BarChart3 className="mx-auto mb-2 h-12 w-12 opacity-50" />
              <p>Nenhum dado disponível</p>
              <p className="text-sm">
                As tendências aparecerão conforme você navegar pelo catálogo
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ProductsTabProps {
  topProducts: TrendProduct[] | undefined;
  isLoading: boolean;
}

export function ProductsTabContent({ topProducts, isLoading }: ProductsTabProps) {
  const navigate = useNavigate();
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Top 10 Produtos</CardTitle>
          <CardDescription>Produtos com mais visualizações</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : topProducts?.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topProducts.slice(0, 5)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" className="text-xs" />
                <YAxis
                  type="category"
                  dataKey="name"
                  className="text-xs"
                  width={120}
                  tickFormatter={(v) => (v.length > 15 ? `${v.slice(0, 15)}...` : v)}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="views" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[300px] items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Package className="mx-auto mb-2 h-12 w-12 opacity-50" />
                <p>Nenhum produto visualizado ainda</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detalhamento</CardTitle>
          <CardDescription>Breakdown por tipo de interação</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : topProducts?.length ? (
            <div className="max-h-[300px] space-y-3 overflow-y-auto">
              {topProducts.map((product, index) => (
                <div
                  key={product.id}
                  className="group flex items-center gap-3 rounded-lg bg-muted/50 p-3 transition-colors hover:bg-muted"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {index < 3 ? ['🥇', '🥈', '🥉'][index] : index + 1}
                  </div>
                  <div
                    className="min-w-0 flex-1 cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onClick={() => product.id && navigate(`/produto/${product.id}`)}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ' ') && product.id) {
                        e.preventDefault();
                        navigate(`/produto/${product.id}`);
                      }
                    }}
                    aria-label={`Ver produto ${product.name}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <p className="truncate font-medium text-foreground">{product.name}</p>
                      {(product.trendingScore ?? 0) > 1.3 && (
                        <Badge
                          variant="outline"
                          className="h-4 shrink-0 border-success/30 bg-success/10 px-1 text-[9px] text-success"
                        >
                          <TrendingUp className="mr-0.5 h-2.5 w-2.5" />
                          {Math.round(((product.trendingScore ?? 0) - 1) * 100)}%
                        </Badge>
                      )}
                      {product.classification === 'new' && (
                        <Badge
                          variant="outline"
                          className="h-4 shrink-0 border-primary/30 bg-primary/10 px-1 text-[9px] text-primary"
                        >
                          <Sparkles className="mr-0.5 h-2.5 w-2.5" />
                          NOVO
                        </Badge>
                      )}
                    </div>
                    {product.sku && (
                      <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                    <Badge variant="secondary" className="text-xs">
                      <Eye className="mr-1 h-3 w-3" />
                      {product.views}
                    </Badge>
                    {(product.compares ?? 0) > 0 && (
                      <Badge variant="outline" className="text-xs">
                        Comp: {product.compares}
                      </Badge>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (product.id) navigate(`/orcamentos/novo?produto=${product.id}`);
                      }}
                      title="Criar orçamento"
                      aria-label="Criar orçamento com este produto"
                    >
                      <FileText className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (product.id) navigate(`/produto/${product.id}`);
                      }}
                      title="Ver detalhes"
                      aria-label="Ver detalhes do produto"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-[300px] items-center justify-center text-muted-foreground">
              <p>Nenhum dado disponível</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface SearchesTabProps {
  topSearches: TrendSearch[] | undefined;
  isLoading: boolean;
}

export function SearchesTabContent({ topSearches, isLoading }: SearchesTabProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Top 10 Buscas</CardTitle>
          <CardDescription>Termos mais pesquisados</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : topSearches?.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topSearches.slice(0, 5)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" className="text-xs" />
                <YAxis
                  type="category"
                  dataKey="term"
                  className="text-xs"
                  width={100}
                  tickFormatter={(v) => (v.length > 12 ? `${v.slice(0, 12)}...` : v)}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar
                  dataKey="count"
                  name="Buscas"
                  fill="hsl(var(--chart-2))"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[300px] items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Search className="mx-auto mb-2 h-12 w-12 opacity-50" />
                <p>Nenhuma busca registrada ainda</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detalhamento de Buscas</CardTitle>
          <CardDescription>Quantidade de buscas e resultados médios</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : topSearches?.length ? (
            <div className="max-h-[300px] space-y-3 overflow-y-auto">
              {topSearches.map((search, index) => (
                <div
                  key={search.term}
                  className="flex items-center gap-3 rounded-lg bg-muted/50 p-3"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-chart-2/10 text-sm font-bold text-chart-2">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">"{search.term}"</p>
                    <p className="text-xs text-muted-foreground">
                      Média de {search.avgResults} resultados
                    </p>
                  </div>
                  <Badge variant="secondary">{search.count}x</Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-[300px] items-center justify-center text-muted-foreground">
              <p>Nenhum dado disponível</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
