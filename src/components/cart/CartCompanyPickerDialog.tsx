/**
 * CartCompanyPickerDialog - Modal de seleção de empresa com Recentes/Favoritas/Buscar.
 * Substitui o picker inline que empurrava conteúdo. Usa localStorage para persistência leve.
 */
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import Fuse from 'fuse.js';
import { Building2, Search, Loader2, Star, Clock, Globe } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { selectCrm, searchCrm } from '@/lib/crm-db';
import { getCompanyDisplayName, type CrmCompany } from '@/types/crm';
import { useSellerCartContext } from '@/contexts/SellerCartContext';
import type { CreateCartInput } from '@/hooks/products';

interface CompanyItem {
  id: string;
  name: string;
  razao_social: string;
  nome_fantasia: string | null;
  ramo: string | null;
  logo_url: string | null;
}

const RECENT_KEY = 'cart-companies-recent';
const FAV_KEY = 'cart-companies-favorites';
const MAX_RECENT = 5;

function readList(key: string): CompanyItem[] {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}
function writeList(key: string, list: CompanyItem[]) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

interface CartCompanyPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Recebe o carrinho recém-criado (id) para permitir ações encadeadas (ex.: adicionar item pendente). */
  onCreated?: (cartId?: string) => void;
}

export function CartCompanyPickerDialog({
  open,
  onOpenChange,
  onCreated,
}: CartCompanyPickerDialogProps) {
  const [tab, setTab] = useState<'recent' | 'favorites' | 'search'>('recent');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [recents, setRecents] = useState<CompanyItem[]>(() => readList(RECENT_KEY));
  const [favorites, setFavorites] = useState<CompanyItem[]>(() => readList(FAV_KEY));
  const inputRef = useRef<HTMLInputElement>(null);
  const { createCart, canCreateCart } = useSellerCartContext();

  useEffect(() => {
    if (!open) return;
    setRecents(readList(RECENT_KEY));
    setFavorites(readList(FAV_KEY));
    // Sempre abre na aba "Todas" (busca) para o usuário poder digitar imediatamente.
    setTab('search');
    // Aguarda a aba "search" montar para garantir que inputRef.current exista.
    const t = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 120);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 280);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const { data: localCompanies = [], isLoading: loadingLocal } = useQuery({
    queryKey: ['cart-companies-local'],
    queryFn: async () => {
      const companies = await selectCrm<CrmCompany>('companies', {
        select: 'id, razao_social, nome_fantasia, logo_url, ramo_atividade',
        filters: { deleted_at: null, is_customer: true },
        orderBy: { column: 'razao_social', ascending: true },
        limit: 200,
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
    enabled: open,
  });

  const { data: serverResults = [], isLoading: loadingServer } = useQuery({
    queryKey: ['cart-companies-search', debouncedSearch],
    queryFn: async () => {
      if (debouncedSearch.length < 3) return [];
      const searchOpts = { orderBy: { column: 'razao_social', ascending: true }, limit: 30 } as const;
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
    enabled: open && debouncedSearch.length >= 3,
  });

  const fuse = useMemo(
    () =>
      new Fuse(localCompanies, { keys: ['name', 'razao_social', 'nome_fantasia'], threshold: 0.4 }),
    [localCompanies],
  );

  const filteredCompanies = useMemo(() => {
    if (!searchTerm) return localCompanies.slice(0, 30);
    const localMatches = fuse.search(searchTerm).map((r) => r.item);
    const ids = new Set(localMatches.map((c) => c.id));
    const merged = [...localMatches];
    for (const sr of serverResults)
      if (!ids.has(sr.id)) {
        merged.push(sr);
        ids.add(sr.id);
      }
    return merged.slice(0, 40);
  }, [searchTerm, fuse, localCompanies, serverResults]);

  const isFavorite = useCallback((id: string) => favorites.some((f) => f.id === id), [favorites]);

  const toggleFavorite = useCallback((company: CompanyItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const next = prev.some((f) => f.id === company.id)
        ? prev.filter((f) => f.id !== company.id)
        : [company, ...prev].slice(0, 20);
      writeList(FAV_KEY, next);
      return next;
    });
  }, []);

  const handleSelect = useCallback(
    async (company: CompanyItem) => {
      const input: CreateCartInput = {
        company_id: company.id,
        company_name: company.name,
        company_location: company.ramo || undefined,
        company_logo_url: company.logo_url || undefined,
      };
      const result = await createCart(input);
      if (result) {
        const nextRecents = [company, ...recents.filter((r) => r.id !== company.id)].slice(
          0,
          MAX_RECENT,
        );
        writeList(RECENT_KEY, nextRecents);
        setRecents(nextRecents);
        onCreated?.(result.id);
        onOpenChange(false);
      }
    },
    [createCart, onCreated, onOpenChange, recents],
  );

  const isLoading = loadingLocal || loadingServer;

  const renderRow = (company: CompanyItem) => (
    <button
      key={company.id}
      type="button"
      data-testid="cart-company-picker-select"
      data-company-id={company.id}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left',
        'group transition-colors hover:bg-accent/60',
      )}
      onClick={() => handleSelect(company)}
      disabled={!canCreateCart}
    >
      {company.logo_url ? (
        <img
          src={company.logo_url}
          alt=""
          className="h-9 w-9 flex-shrink-0 rounded-full border border-border/40 bg-background object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-muted">
          <Building2 className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{company.name}</p>
        {company.ramo && (
          <p className="truncate text-[11px] text-muted-foreground">{company.ramo}</p>
        )}
      </div>
      <button
        type="button"
        onClick={(e) => toggleFavorite(company, e)}
        className={cn(
          'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md transition-colors',
          isFavorite(company.id)
            ? 'text-warning'
            : 'text-muted-foreground/40 opacity-0 hover:text-warning group-hover:opacity-100',
        )}
        aria-label={isFavorite(company.id) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
      >
        <Star className={cn('h-4 w-4', isFavorite(company.id) && 'fill-current')} />
      </button>
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-[520px]">
        <DialogHeader className="px-5 pb-3 pt-5">
          <DialogTitle className="font-display text-lg">Vincular a uma empresa</DialogTitle>
          <DialogDescription className="text-xs">
            Escolha uma empresa para criar o carrinho.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="w-full">
          <div className="px-5">
            <TabsList className="grid h-9 w-full grid-cols-3">
              <TabsTrigger value="recent" className="gap-1.5 text-xs">
                <Clock className="h-3.5 w-3.5" />
                Recentes
              </TabsTrigger>
              <TabsTrigger value="favorites" className="gap-1.5 text-xs">
                <Star className="h-3.5 w-3.5" />
                Favoritas
              </TabsTrigger>
              <TabsTrigger value="search" className="gap-1.5 text-xs">
                <Globe className="h-3.5 w-3.5" />
                Todas
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="recent" className="m-0 px-3 pb-4 pt-3">
            <ScrollArea className="h-[340px] pr-2">
              {isLoading ? (
                <div className="space-y-1 py-1">
                  {Array.from({ length: 4 }, (_, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2.5">
                      <Skeleton className="h-9 w-9 rounded-lg opacity-20" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-3 w-3/4 opacity-15" />
                        <Skeleton className="h-2 w-1/2 opacity-10" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : recents.length > 0 ? (
                <div className="space-y-0.5">{recents.map(renderRow)}</div>
              ) : (
                <p className="py-12 text-center text-xs text-muted-foreground">
                  Sem empresas recentes ainda.
                </p>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="favorites" className="m-0 px-3 pb-4 pt-3">
            <ScrollArea className="h-[340px] pr-2">
              {isLoading ? (
                <div className="space-y-1 py-1">
                  {Array.from({ length: 3 }, (_, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2.5">
                      <Skeleton className="h-9 w-9 rounded-lg opacity-20" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-3 w-3/4 opacity-15" />
                        <Skeleton className="h-2 w-1/2 opacity-10" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : favorites.length > 0 ? (
                <div className="space-y-0.5">{favorites.map(renderRow)}</div>
              ) : (
                <p className="py-12 text-center text-xs text-muted-foreground">
                  Marque empresas como favoritas usando a estrela.
                </p>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="search" className="m-0 space-y-3 px-3 pb-4 pt-3">
            <div className="relative px-2">
              <Search className="left-4.5 absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Nome, CNPJ ou segmento..."
                className="h-9 border-border/40 bg-muted/20 pl-8 text-sm transition-colors focus:bg-background"
              />
              {isLoading && (
                <Loader2 className="right-4.5 absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground opacity-50" />
              )}
            </div>
            <ScrollArea className="h-[290px] pr-2">
              {isLoading && filteredCompanies.length === 0 ? (
                <div className="space-y-1 px-1">
                  {Array.from({ length: 6 }, (_, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2.5">
                      <Skeleton className="h-9 w-9 rounded-lg opacity-20" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-3 w-3/4 opacity-15" />
                        <Skeleton className="h-2 w-1/2 opacity-10" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredCompanies.length > 0 ? (
                <div className="space-y-0.5">{filteredCompanies.map(renderRow)}</div>
              ) : !isLoading ? (
                <p className="py-12 text-center text-xs text-muted-foreground">
                  Nenhuma empresa encontrada.
                </p>
              ) : null}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 border-t border-border/40 px-5 py-3">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
