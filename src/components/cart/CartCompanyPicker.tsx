/**
 * CartCompanyPicker - Seletor compacto de empresa para criação de carrinho
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import Fuse from 'fuse.js';
import { Building2, Search, Loader2, Clock, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { selectCrm, searchCrm } from '@/lib/crm-db';
import { getCompanyDisplayName, type CrmCompany } from '@/types/crm';
import { useSellerCartContext } from '@/contexts/SellerCartContext';
import type { CreateCartInput } from '@/hooks/products';
import { useSearchHistory } from '@/hooks/common';

interface CompanyItem {
  id: string;
  name: string;
  razao_social: string;
  nome_fantasia: string | null;
  ramo: string | null;
  logo_url: string | null;
}

interface CartCompanyPickerProps {
  onCreated?: () => void;
  onCancel?: () => void;
}

export function CartCompanyPicker({ onCreated, onCancel }: CartCompanyPickerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { createCart, canCreateCart } = useSellerCartContext();
  const { history, addToHistory, removeFromHistory, clearHistory } = useSearchHistory('company');

  // Debounce server search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Focus input on mount
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  // Local companies cache
  const { data: localCompanies = [], isLoading: loadingLocal } = useQuery({
    queryKey: ['cart-companies-local'],
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
          razao_social: c.razao_social,
          nome_fantasia: c.nome_fantasia || null,
          ramo: c.ramo_atividade || null,
          logo_url: c.logo_url || null,
        }),
      );
    },
    staleTime: 15 * 60 * 1000,
  });

  // Server search for long queries — searches both razao_social and nome_fantasia
  const { data: serverResults = [], isLoading: loadingServer } = useQuery({
    queryKey: ['cart-companies-search', debouncedSearch],
    queryFn: async () => {
      if (debouncedSearch.length < 3) return [];
      const searchOpts = { orderBy: { column: 'razao_social', ascending: true }, limit: 20 } as const;
      const [byRazao, byFantasia] = await Promise.all([
        searchCrm<CrmCompany>('companies', 'razao_social', debouncedSearch, searchOpts),
        searchCrm<CrmCompany>('companies', 'nome_fantasia', debouncedSearch, searchOpts),
      ]);
      const seen = new Set<string>();
      const deduped: CrmCompany[] = [];
      for (const c of [...byRazao, ...byFantasia]) {
        if (!seen.has(c.id)) {
          seen.add(c.id);
          deduped.push(c);
        }
      }
      return deduped.map(
        (c): CompanyItem => ({
          id: c.id,
          name: getCompanyDisplayName(c),
          razao_social: c.razao_social,
          nome_fantasia: c.nome_fantasia || null,
          ramo: c.ramo_atividade || null,
          logo_url: c.logo_url || null,
        }),
      );
    },
    enabled: debouncedSearch.length >= 3,
  });

  // Fuse.js for local fuzzy search
  const fuse = useMemo(() => {
    return new Fuse(localCompanies, {
      keys: ['name', 'razao_social', 'nome_fantasia'],
      threshold: 0.4,
    });
  }, [localCompanies]);

  const filteredCompanies = useMemo(() => {
    if (!searchTerm) return localCompanies.slice(0, 20);

    const localResults = fuse.search(searchTerm).map((r) => r.item);

    // Merge server results (deduplicate)
    const ids = new Set(localResults.map((c) => c.id));
    const merged = [...localResults];
    for (const sr of serverResults) {
      if (!ids.has(sr.id)) {
        merged.push(sr);
        ids.add(sr.id);
      }
    }
    return merged.slice(0, 30);
  }, [searchTerm, fuse, localCompanies, serverResults]);

  const handleSelect = useCallback(
    async (company: {
      id: string;
      name: string;
      ramo?: string | null;
      logo_url?: string | null;
    }) => {
      addToHistory({
        id: company.id,
        label: company.name,
        type: 'company',
      });

      const input: CreateCartInput = {
        company_id: company.id,
        company_name: company.name,
        company_location: company.ramo || undefined,
        company_logo_url: company.logo_url || undefined,
      };
      await createCart(input);
      onCreated?.();
    },
    [createCart, onCreated, addToHistory],
  );

  const isLoading = loadingLocal || loadingServer;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <h4 className="flex-1 text-sm font-semibold">Nova empresa</h4>
        {onCancel && (
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar empresa..."
          className="h-8 pl-8 text-sm"
        />
        {isLoading && (
          <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      <ScrollArea className="h-[200px]">
        <div className="space-y-0.5">
          {!searchTerm && history.length > 0 && (
            <div className="mb-2 border-b border-border/50 pb-2">
              <div className="mb-1 flex items-center justify-between px-2">
                <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Visitados Recentemente
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 text-[10px]"
                  onClick={clearHistory}
                >
                  Limpar
                </Button>
              </div>
              {history.slice(0, 3).map((item) => (
                <div key={item.id} className="group relative">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-accent/50"
                    onClick={() => handleSelect({ id: item.id, name: item.label })}
                  >
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="flex-1 truncate">{item.label}</span>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remover ${item.label} do histórico`}
                    className="absolute right-1 top-1/2 h-5 w-5 -translate-y-1/2 opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromHistory(item.id);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {filteredCompanies.map((company) => (
            <button
              key={company.id}
              type="button"
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left',
                'text-sm transition-colors hover:bg-accent/50',
              )}
              onClick={() => handleSelect(company)}
              disabled={!canCreateCart}
            >
              {company.logo_url ? (
                <img
                  src={company.logo_url}
                  alt={company.name}
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
          {filteredCompanies.length === 0 && !isLoading && (
            <p className="py-4 text-center text-xs text-muted-foreground">
              Nenhuma empresa encontrada
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
