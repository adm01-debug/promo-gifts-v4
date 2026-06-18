/**
 * KitTemplatesMetricsPage — Painel admin com métricas de adoção de templates
 * + heatmap dos itens (SKUs) mais usados em kits do sistema.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageSEO } from '@/components/seo/PageSEO';
import { TrendingUp, Package, Award } from 'lucide-react';
import { formatCurrency } from '@/lib/kit-builder';

interface TemplateRow {
  id: string;
  name: string;
  tag: string | null;
  color: string;
  total_price: number;
  usage_count: number;
  updated_at: string;
  category: string;
}

interface KitRow {
  id: string;
  items_data: unknown;
}

function extractItems(items: unknown): Array<{ sku: string; name: string }> {
  if (!Array.isArray(items)) return [];
  return items
    .map((i) => {
      const r = i as Record<string, unknown>;
      const sku = (r?.sku ?? r?.product_sku ?? r?.code) as string | undefined;
      const name = (r?.name ?? r?.product_name) as string | undefined;
      return sku ? { sku: String(sku).toLowerCase(), name: name ?? String(sku) } : null;
    })
    .filter((x): x is { sku: string; name: string } => !!x);
}

export default function KitTemplatesMetricsPage() {
  const { data: templates, isLoading: loadingTemplates } = useQuery({
    queryKey: ['admin-kit-templates-metrics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kit_templates')
        .select('id, name, tag, color, total_price, usage_count, updated_at, category')
        .order('usage_count', { ascending: false });
      if (error) throw error;
      return (data ?? []) as TemplateRow[];
    },
  });

  const { data: heatmap, isLoading: loadingHeatmap } = useQuery({
    queryKey: ['admin-kit-items-heatmap'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_kits')
        .select('id, items_data')
        .limit(1000);
      if (error) throw error;
      const counter = new Map<string, { name: string; count: number }>();
      for (const row of (data ?? []) as KitRow[]) {
        for (const it of extractItems(row.items_data)) {
          const cur = counter.get(it.sku);
          if (cur) cur.count += 1;
          else counter.set(it.sku, { name: it.name, count: 1 });
        }
      }
      return [...counter.entries()]
        .map(([sku, v]) => ({ sku, name: v.name, count: v.count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);
    },
  });

  const stats = useMemo(() => {
    const list = templates ?? [];
    const totalUsage = list.reduce((s, t) => s + (t.usage_count || 0), 0);
    const popular = list.filter((t) => (t.usage_count || 0) >= 5).length;
    return { total: list.length, totalUsage, popular };
  }, [templates]);

  const maxCount = heatmap?.[0]?.count ?? 1;

  return (
    <>
      <PageSEO
        title="Métricas de Templates de Kit"
        description="Adoção e desempenho dos templates de kit do sistema."
        path="/admin/kit-templates/metricas"
        noIndex
      />
      <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-3 px-3 py-3 pb-24 sm:space-y-4 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8">
        <div>
          <h1
            data-testid="page-title-kit-templates-metrics"
            className="font-display text-2xl font-semibold"
          >
            Métricas de Kits
          </h1>
          <p className="text-sm text-muted-foreground">
            Adoção de templates e itens mais usados pela equipe.
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Templates ativos</p>
                <p className="font-display text-2xl font-semibold">{stats.total}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Clonagens totais</p>
                <p className="font-display text-2xl font-semibold">{stats.totalUsage}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Award className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Templates populares (≥5 usos)</p>
                <p className="font-display text-2xl font-semibold">{stats.popular}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Templates table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ranking de templates</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingTemplates ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Template</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Preço</TableHead>
                    <TableHead className="text-right">Clonagens</TableHead>
                    <TableHead>Última atualização</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(templates ?? []).map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: t.color }}
                          />
                          <span className="font-medium">{t.name}</span>
                          {t.tag && (
                            <Badge variant="outline" className="text-[10px]">
                              {t.tag}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px]">
                          {t.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(t.total_price)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={t.usage_count >= 5 ? 'default' : 'outline'}>
                          {t.usage_count}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(t.updated_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Heatmap items */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 20 itens mais usados em kits</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingHeatmap ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : (heatmap ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
            ) : (
              <div className="space-y-1.5">
                {(heatmap ?? []).map((item, idx) => (
                  <div key={item.sku} className="flex items-center gap-3 text-sm">
                    <span className="w-6 text-right tabular-nums text-muted-foreground">
                      {idx + 1}.
                    </span>
                    <span className="flex-1 truncate font-medium">{item.name}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {item.count}×
                    </span>
                    <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${(item.count / maxCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
