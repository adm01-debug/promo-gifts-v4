/**
 * MyClientsWidget — agrega clientes únicos do usuário a partir das tabelas
 * quotes e orders (seller_id = auth.uid()). Mostra contadores de propostas,
 * pedidos e total transacionado, com busca, filtro de origem e infinite scroll.
 *
 * Notas:
 * - Defesa em profundidade: filtro explícito por seller_id sobre RLS existente.
 * - Chave de agregação: client_company || client_name || client_email (lower).
 */
import { useMemo, useState, useCallback } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Users, ArrowRight, FileText, Package, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  WidgetFiltersBar,
  EMPTY_FILTERS,
  matchesSearch,
  type WidgetFiltersValue,
} from './widget-filters/WidgetFiltersBar';
import { useInfiniteScroll } from './widget-filters/useInfiniteScroll';

const PAGE_SIZE = 100;

type Source = 'quote' | 'order';

interface ClientRow {
  key: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  quotes: number;
  orders: number;
  total: number;
  lastInteraction: string;
  sources: Set<Source>;
}

const SOURCE_OPTIONS = [
  { value: 'quote', label: 'Com propostas' },
  { value: 'order', label: 'Com pedidos' },
];

function aggregate(
  quotes: Array<{
    client_name: string | null;
    client_company: string | null;
    client_email: string | null;
    client_phone: string | null;
    total: number | null;
    updated_at: string;
  }>,
  orders: Array<{
    client_name: string | null;
    client_company: string | null;
    client_email: string | null;
    client_phone: string | null;
    total: number | null;
    updated_at: string;
  }>,
): ClientRow[] {
  const map = new Map<string, ClientRow>();
  const upsert = (
    src: Source,
    row: {
      client_name: string | null;
      client_company: string | null;
      client_email: string | null;
      client_phone: string | null;
      total: number | null;
      updated_at: string;
    },
  ) => {
    const id = (row.client_company || row.client_name || row.client_email || '')
      .trim()
      .toLowerCase();
    if (!id) return;
    let r = map.get(id);
    if (!r) {
      r = {
        key: id,
        name: row.client_name || row.client_company || row.client_email || 'Cliente',
        company: row.client_company,
        email: row.client_email,
        phone: row.client_phone,
        quotes: 0,
        orders: 0,
        total: 0,
        lastInteraction: row.updated_at,
        sources: new Set(),
      };
      map.set(id, r);
    }
    r.sources.add(src);
    if (src === 'quote') r.quotes += 1;
    else r.orders += 1;
    r.total += Number(row.total ?? 0);
    if (row.updated_at > r.lastInteraction) r.lastInteraction = row.updated_at;
    r.email ||= row.client_email;
    r.phone ||= row.client_phone;
    r.company ||= row.client_company;
  };
  for (const q of quotes) upsert('quote', q);
  for (const o of orders) upsert('order', o);
  return Array.from(map.values()).sort((a, b) => (a.lastInteraction < b.lastInteraction ? 1 : -1));
}

export function MyClientsWidget() {
  const { user } = useAuth();
  const userId = user?.id;
  const navigate = useNavigate();
  const [filters, setFilters] = useState<WidgetFiltersValue>(EMPTY_FILTERS);

  // Paginação cursor sobre quotes; orders sempre carrega o lote inicial e
  // depois acompanha a janela conforme novos quotes chegam (best-effort:
  // usamos um cursor compartilhado por updated_at).
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['my-clients-widget', userId],
    enabled: !!userId,
    staleTime: 60_000,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      if (!userId) return { quotes: [], orders: [] };
      const baseQuotes = supabase
        .from('quotes')
        .select('client_name, client_company, client_email, client_phone, total, updated_at')
        .eq('seller_id', userId)
        .order('updated_at', { ascending: false })
        .limit(PAGE_SIZE);
      const baseOrders = supabase
        .from('orders')
        .select('client_name, client_company, client_email, client_phone, total, updated_at')
        .eq('seller_id', userId)
        .order('updated_at', { ascending: false })
        .limit(PAGE_SIZE);
      const qQuery = pageParam ? baseQuotes.lt('updated_at', pageParam) : baseQuotes;
      const oQuery = pageParam ? baseOrders.lt('updated_at', pageParam) : baseOrders;
      const [qRes, oRes] = await Promise.all([qQuery, oQuery]);
      if (qRes.error) throw qRes.error;
      if (oRes.error) throw oRes.error;
      return { quotes: qRes.data ?? [], orders: oRes.data ?? [] };
    },
    getNextPageParam: (last) => {
      const lastQ = last.quotes[last.quotes.length - 1]?.updated_at;
      const lastO = last.orders[last.orders.length - 1]?.updated_at;
      const more = last.quotes.length >= PAGE_SIZE || last.orders.length >= PAGE_SIZE;
      if (!more) return undefined;
      // Cursor = o mais antigo entre os dois lotes para garantir cobertura.
      const cursor = [lastQ, lastO].filter(Boolean).sort()[0];
      return cursor ?? undefined;
    },
  });

  const clients = useMemo(() => {
    const allQ = (data?.pages.flatMap((p) => p.quotes) ?? []).map((q) => ({
      ...q,
      updated_at: q.updated_at ?? '',
    }));
    const allO = (data?.pages.flatMap((p) => p.orders) ?? []).map((o) => ({
      ...o,
      updated_at: o.updated_at ?? '',
    }));
    return aggregate(allQ, allO);
  }, [data]);

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      if (filters.status === 'quote' && !c.sources.has('quote')) return false;
      if (filters.status === 'order' && !c.sources.has('order')) return false;
      return matchesSearch([c.name, c.company, c.email, c.phone], filters.search);
    });
  }, [clients, filters]);

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const sentinelRef = useInfiniteScroll<HTMLDivElement>(handleLoadMore, {
    enabled: !!hasNextPage,
  });

  if (!isLoading && clients.length === 0) return null;

  return (
    <Card>
      <CardHeader className="space-y-3 pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Users className="h-4 w-4 text-primary" />
            Meus Clientes
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/orcamentos')}
            className="gap-1 text-xs"
          >
            Ver propostas <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
        <WidgetFiltersBar
          value={filters}
          onChange={setFilters}
          statusOptions={SOURCE_OPTIONS}
          searchPlaceholder="Buscar por nome, empresa ou e-mail…"
          showDateRange={false}
        />
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
          {filtered.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              Nenhum cliente encontrado com os filtros atuais.
            </p>
          ) : (
            filtered.map((c) => (
              <div
                key={c.key}
                className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-secondary/50"
              >
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-primary/10">
                  <Users className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.company || c.name}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {c.company && c.name && c.name !== c.company && (
                      <span className="max-w-[160px] truncate">{c.name}</span>
                    )}
                    <Badge variant="outline" className="gap-1 px-1.5 py-0 text-[10px]">
                      <FileText className="h-2.5 w-2.5" /> {c.quotes}
                    </Badge>
                    <Badge variant="outline" className="gap-1 px-1.5 py-0 text-[10px]">
                      <Package className="h-2.5 w-2.5" /> {c.orders}
                    </Badge>
                  </div>
                </div>
                {c.total > 0 && (
                  <p className="flex-shrink-0 text-sm font-semibold text-primary">
                    {c.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                )}
              </div>
            ))
          )}
          {hasNextPage && (
            <div ref={sentinelRef} className="flex items-center justify-center py-3">
              {isFetchingNextPage ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <span className="text-[10px] text-muted-foreground">Role para carregar mais</span>
              )}
            </div>
          )}
        </div>
        <p className="pt-1 text-center text-[10px] text-muted-foreground">
          {filtered.length} cliente(s) · {clients.length} carregado(s){hasNextPage ? '+' : ''}.
        </p>
      </CardContent>
    </Card>
  );
}
