import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Image, Search, Download, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { PageSEO } from '@/components/seo/PageSEO';
import { useDebounce } from '@/hooks/common';
import { MockupHistorySkeleton } from '@/components/loading/ModernSkeletons';
import { DiagnosticProfiler } from '@/components/dev/DiagnosticProfiler';

export default function MockupHistoryPage() {
  const { user } = useAuth();
  const userId = user?.id;
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const pageSize = 20;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['mockup-history', userId, page, debouncedSearch],
    queryFn: async () => {
      if (!userId) return { mockups: [], totalCount: 0 };
      let query = supabase
        .from('generated_mockups')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (debouncedSearch) {
        // BUG-400 FIX (2026-06-01): removed client_name.ilike filter — client_name is
        // not a column on generated_mockups (it lives in area_config JSONB). Using it
        // in an .or() filter causes PostgREST HTTP 400.
        query = query.or(
          `product_name.ilike.%${debouncedSearch}%,product_sku.ilike.%${debouncedSearch}%,technique_name.ilike.%${debouncedSearch}%`,
        );
      }

      const { data, error, count } = await query;
      if (error) throw error;
      // Map area_config JSONB fields into the flat shape the component uses.
      const mockups = (data ?? []).map((row) => {
        const cfg = (row.area_config ?? {}) as Record<string, unknown>;
        return {
          ...row,
          client_name: (cfg.clientName as string | null) ?? null,
          location_name: row.area_name ?? null,
          logo_width_cm: (cfg.logoWidth as number | null) ?? null,
          logo_height_cm: (cfg.logoHeight as number | null) ?? null,
          colors_count: (cfg.colorsCount as number | null) ?? null,
          layout_url: null,
        };
      });
      return { mockups, totalCount: count ?? 0 };
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  // Memoize search field change to avoid re-renders on every keystroke
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  }, []);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('generated_mockups').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao remover mockup');
    } else {
      toast.success('Mockup removido');
      refetch();
    }
  };

  const totalPages = Math.ceil((data?.totalCount ?? 0) / pageSize);

  return (
    <DiagnosticProfiler id="MockupHistory">
      <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-3 px-3 py-3 pb-24 sm:space-y-4 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8">
        <PageSEO
          title="Histórico de Mockups"
          description="Visualize todos os mockups gerados anteriormente."
          path="/mockup-historico"
          noIndex
        />
        <div>
          <h1
            data-testid="page-title-mockup-historico"
            className="flex items-center gap-2 font-display text-2xl font-bold text-foreground"
          >
            <Image className="h-6 w-6" />
            Histórico de Mockups
          </h1>
          <p className="text-muted-foreground">Todos os mockups gerados por você</p>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por produto, SKU ou técnica..."
                value={search}
                onChange={handleSearchChange}
                className="pl-9"
              />
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-primary">{data?.totalCount ?? 0}</p>
              <p className="text-sm text-muted-foreground">Total de Mockups</p>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Mockups Gerados</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Preview</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Técnica</TableHead>
                  <TableHead>Posição</TableHead>
                  <TableHead>Dimensões</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8">
                      <MockupHistorySkeleton count={5} />
                    </TableCell>
                  </TableRow>
                ) : !data?.mockups.length ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                      Nenhum mockup gerado ainda
                    </TableCell>
                  </TableRow>
                ) : (
                  data.mockups.map((m) => (
                    <TableRow key={m.id} data-testid="mockup-history-item">
                      <TableCell>
                        {m.mockup_url ? (
                          <img
                            src={m.mockup_url}
                            alt="Mockup"
                            className="h-12 w-12 rounded border object-cover"
                            loading="lazy"
                            data-testid="mockup-history-preview"
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded bg-muted">
                            <Image className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p
                            className="text-sm font-medium"
                            data-testid="mockup-history-product-name"
                          >
                            {m.product_name || '—'}
                          </p>
                          {m.product_sku && (
                            <p className="font-mono text-xs text-muted-foreground">
                              {m.product_sku}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm" data-testid="mockup-history-client-name">
                        {m.client_name || '—'}
                      </TableCell>
                      <TableCell>
                        {m.technique_name ? (
                          <Badge variant="secondary">{m.technique_name}</Badge>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{m.location_name || '—'}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {m.logo_width_cm && m.logo_height_cm
                          ? `${m.logo_width_cm}×${m.logo_height_cm}cm`
                          : '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {format(new Date(m.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {m.mockup_url && (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Download"
                              onClick={() => m.mockup_url && window.open(m.mockup_url, '_blank')}
                              data-testid="mockup-history-download-btn"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Excluir"
                            onClick={() => handleDelete(m.id)}
                            className="text-destructive hover:text-destructive"
                            data-testid="mockup-history-delete-btn"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Página {page} de {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DiagnosticProfiler>
  );
}
