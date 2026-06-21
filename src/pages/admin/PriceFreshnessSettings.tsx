/**
 * Admin: Validade de Preços
 *
 * Lista todos os overrides (produtos com janela custom 30/60/90 dias)
 * salvos em `public.product_price_freshness_overrides`. Permite restaurar
 * o padrão (60d) por produto.
 *
 * Rota: /admin/validade-precos (admin-only — protegida por AdminRoute).
 */
import { useMemo, useState } from 'react';
import { Trash2, Loader2, Filter, Settings2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageSEO } from '@/components/seo/PageSEO';
import {
  useAllFreshnessOverrides,
  useDeleteFreshnessOverride,
  ALLOWED_FRESHNESS_THRESHOLDS,
} from '@/hooks/products';
import { formatPriceDateLong } from '@/utils/price-freshness';
import { useSystemSettings } from '@/hooks/admin/useSystemSettings';
import { Skeleton } from '@/components/ui/skeleton';

export default function PriceFreshnessSettings() {
  const { data: overrides, isLoading } = useAllFreshnessOverrides();
  const remove = useDeleteFreshnessOverride();
  const [filter, setFilter] = useState<'30' | '60' | '90' | 'all'>('all');

  const { getSetting, updateSetting, isLoading: isSettingsLoading } = useSystemSettings();
  const globalDefault = getSetting('default_price_freshness_threshold', '60');

  const filtered = useMemo(() => {
    if (!overrides) return [];
    if (filter === 'all') return overrides;
    return overrides.filter((o) => String(o.threshold_days) === filter);
  }, [overrides, filter]);

  const counts = useMemo(() => {
    const base: Record<string, number> = { 30: 0, 60: 0, 90: 0 };
    overrides?.forEach((o) => {
      base[String(o.threshold_days)] = (base[String(o.threshold_days)] ?? 0) + 1;
    });
    return base;
  }, [overrides]);

  return (
    <>
      <PageSEO
        title="Validade de Preços | Admin"
        description="Configure a janela de validade do alerta de preço por produto (30, 60 ou 90 dias)."
      />
      <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-6 px-3 py-3 pb-24 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8">
        <div className="flex flex-col gap-1">
          <h1
            data-testid="page-title-validade-precos"
            className="font-display text-2xl font-bold text-foreground"
          >
            Validade de Preços
          </h1>
          <p className="text-sm text-muted-foreground">
            Gerencie o tempo de expiração dos preços no catálogo e configure padrões globais.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-1">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-primary" />
                <CardTitle className="text-base font-semibold">Padrão Global</CardTitle>
              </div>
              <CardDescription>
                Define a validade padrão usada para todos os produtos que não possuem override
                manual.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Janela Padrão
                </label>
                {isSettingsLoading ? (
                  <Skeleton className="h-9 w-full" />
                ) : (
                  <Select
                    value={globalDefault}
                    onValueChange={(v) =>
                      updateSetting.mutate({ key: 'default_price_freshness_threshold', value: v })
                    }
                    disabled={updateSetting.isPending}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 dias</SelectItem>
                      <SelectItem value="60">60 dias</SelectItem>
                      <SelectItem value="90">90 dias</SelectItem>
                      <SelectItem value="120">120 dias</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Alterar este valor afetará imediatamente o alerta de todos os produtos sem
                  configuração específica.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base font-semibold">
                    Overrides Legados ({overrides?.length ?? 0})
                  </CardTitle>
                </div>
                <CardDescription>
                  Estes são overrides salvos no banco local (Supabase). Novos produtos devem ser
                  configurados diretamente na ficha técnica no Admin de Produtos.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
                  <SelectTrigger className="h-8 w-[140px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {ALLOWED_FRESHNESS_THRESHOLDS.map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {d} dias ({counts[String(d)] ?? 0})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Carregando…
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  Nenhum produto com validade customizada.
                  <br />
                  Configure pela página do produto, no botão <strong>“Validade”</strong> ao lado do
                  preço.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto (ID)</TableHead>
                      <TableHead className="w-32">Validade</TableHead>
                      <TableHead className="w-48">Atualizado em</TableHead>
                      <TableHead className="w-28 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono text-xs">{o.product_id}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{o.threshold_days} dias</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatPriceDateLong(new Date(o.updated_at))}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-muted-foreground hover:text-destructive"
                            disabled={remove.isPending}
                            onClick={() => remove.mutate(o.product_id)}
                          >
                            <Trash2 className="mr-1 h-3 w-3" />
                            Restaurar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
