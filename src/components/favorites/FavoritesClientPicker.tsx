/**
 * FavoritesClientPicker — Seletor leve de cliente CRM para vincular a lista.
 * Reusa a query do CartCompanyPicker mas SEM o efeito colateral de criar carrinho.
 */
import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import Fuse from 'fuse.js';
import { Building2, Search, Loader2, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { selectCrm, searchCrm } from '@/lib/crm-db';
import { getCompanyDisplayName, type CrmCompany } from '@/types/crm';

interface CompanyItem {
  id: string;
  name: string;
  ramo: string | null;
  logo_url: string | null;
}

interface Props {
  selectedClientId?: string | null;
  selectedClientName?: string | null;
  onSelect: (client: { id: string; name: string } | null) => void;
}

export function FavoritesClientPicker({ selectedClientId, selectedClientName, onSelect }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const { data: localCompanies = [], isLoading: loadingLocal } = useQuery({
    queryKey: ['fav-client-picker-local'],
    queryFn: async () => {
      const companies = await selectCrm<CrmCompany>('companies', {
        select: 'id, razao_social, nome_fantasia, logo_url, ramo_atividade',
        filters: { deleted_at: null, is_customer: true },
        orderBy: { column: 'razao_social', ascending: true },
        limit: 100,
      });
      return companies.map(
        (c): CompanyItem => ({
          id: c.id,
          name: getCompanyDisplayName(c),
          ramo: c.ramo_atividade || null,
          logo_url: c.logo_url || null,
        }),
      );
    },
    staleTime: 15 * 60 * 1000,
  });

  const { data: serverResults = [], isLoading: loadingServer } = useQuery({
    queryKey: ['fav-client-picker-search', debounced],
    queryFn: async () => {
      if (debounced.length < 3) return [];
      const results = await searchCrm<CrmCompany>('companies', 'razao_social', debounced, {
        orderBy: { column: 'razao_social', ascending: true },
        limit: 20,
      });
      return results.map(
        (c): CompanyItem => ({
          id: c.id,
          name: getCompanyDisplayName(c),
          ramo: c.ramo_atividade || null,
          logo_url: c.logo_url || null,
        }),
      );
    },
    enabled: debounced.length >= 3,
  });

  const fuse = useMemo(
    () => new Fuse(localCompanies, { keys: ['name'], threshold: 0.4 }),
    [localCompanies],
  );

  const list = useMemo(() => {
    if (!searchTerm) return localCompanies.slice(0, 20);
    const local = fuse.search(searchTerm).map((r) => r.item);
    const ids = new Set(local.map((c) => c.id));
    const merged = [...local];
    for (const sr of serverResults) {
      if (!ids.has(sr.id)) merged.push(sr);
    }
    return merged.slice(0, 30);
  }, [searchTerm, fuse, localCompanies, serverResults]);

  const isLoading = loadingLocal || loadingServer;

  // Quando já tem cliente selecionado, mostra chip e permite remover
  if (selectedClientId && selectedClientName) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{selectedClientName}</p>
            <p className="text-[10px] text-muted-foreground">Cliente vinculado</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => onSelect(null)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar cliente CRM (opcional)..."
          className="h-9 pl-8 text-sm"
        />
        {isLoading && (
          <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {searchTerm && (
        <ScrollArea className="h-[180px] rounded-md border border-border bg-background/50">
          <div className="space-y-0.5 p-1">
            {list.map((company) => (
              <button
                key={company.id}
                type="button"
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left',
                  'text-sm transition-colors hover:bg-accent',
                )}
                onClick={() => onSelect({ id: company.id, name: company.name })}
              >
                {company.logo_url ? (
                  <img
                    src={company.logo_url}
                    alt=""
                    className="h-6 w-6 flex-shrink-0 rounded-full border border-border bg-background object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-muted">
                    <Building2 className="h-3 w-3 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{company.name}</p>
                  {company.ramo && (
                    <p className="truncate text-[10px] text-muted-foreground">{company.ramo}</p>
                  )}
                </div>
              </button>
            ))}
            {list.length === 0 && !isLoading && (
              <p className="py-4 text-center text-xs text-muted-foreground">
                Nenhuma empresa encontrada
              </p>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
