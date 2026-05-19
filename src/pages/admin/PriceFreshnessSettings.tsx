/**
 * Admin: Validade de Preços
 *
 * Lista todos os overrides (produtos com janela custom 30/60/90 dias)
 * salvos em `public.product_price_freshness_overrides`. Permite restaurar
 * o padrão (60d) por produto.
 *
 * Rota: /admin/validade-precos (admin-only — protegida por AdminRoute).
 */
import { useMemo, useState } from "react";
import { Trash2, Loader2, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageSEO } from "@/components/seo/PageSEO";
import {
  useAllFreshnessOverrides,
  useDeleteFreshnessOverride,
  ALLOWED_FRESHNESS_THRESHOLDS,
} from "@/hooks/products";
import { formatPriceDateLong } from "@/utils/price-freshness";

export default function PriceFreshnessSettings() {
  const { data: overrides, isLoading } = useAllFreshnessOverrides();
  const remove = useDeleteFreshnessOverride();
  const [filter, setFilter] = useState<"all" | "30" | "60" | "90">("all");

  const filtered = useMemo(() => {
    if (!overrides) return [];
    if (filter === "all") return overrides;
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
        <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-3 sm:py-4 space-y-3 sm:space-y-4 pb-24 md:pb-6 animate-fade-in">
          <div className="mb-6">
            <h1 data-testid="page-title-validade-precos" className="text-2xl font-display font-bold text-foreground">
              Validade de Preços
            </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Produtos com janela de validade customizada. Sem override, o padrão
          do sistema é <strong>60 dias</strong>.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <CardTitle className="text-base">
            Overrides ativos ({overrides?.length ?? 0})
          </CardTitle>
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
              Configure pela página do produto, no botão{" "}
              <strong>“Validade”</strong> ao lado do preço.
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
                    <TableCell className="font-mono text-xs">
                      {o.product_id}
                    </TableCell>
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
      </>
  );
}
