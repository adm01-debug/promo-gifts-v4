/**
 * CompanySearchDropdown — Dropdown de busca de empresas com Fuse.js + server-side
 */
import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import Fuse from 'fuse.js';
import { Building2, Search, X, Loader2, Clock, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { m as motion, AnimatePresence } from 'framer-motion';
import { selectCrm, searchCrm } from '@/lib/crm-db';
import { getCompanyDisplayName, type CrmCompany } from '@/types/crm';
import { CompanyAvatar, type CompanyOption } from './shared-types';
import { useSearchHistory } from '@/hooks/common';

interface CompanyMeta {
  cnpj?: string | null;
  razao_social?: string | null;
  logo_url?: string | null;
}

interface CompanySearchDropdownProps {
  companyId: string;
  selectedCompany: CompanyOption | null;
  onSelectCompany: (id: string) => void;
  onClearCompany: () => void;
}

export function CompanySearchDropdown({
  companyId,
  selectedCompany,
  onSelectCompany,
  onClearCompany,
}: CompanySearchDropdownProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { history, addToHistory, removeFromHistory, clearHistory } = useSearchHistory('company');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data: companies, isLoading: loadingCompanies } = useQuery<CompanyOption[]>({
    queryKey: ['quote-companies-selector'],
    queryFn: async () => {
      const data = await selectCrm<CrmCompany>('companies', {
        select: 'id, razao_social, nome_fantasia, ramo_atividade, cnpj, logo_url',
        filters: { deleted_at: null },
        orderBy: { column: 'razao_social', ascending: true },
        limit: 500,
      });
      return data.map((c) => ({
        id: c.id,
        name: getCompanyDisplayName(c),
        razao_social: c.razao_social,
        nome_fantasia: c.nome_fantasia,
        ramo_atividade: c.ramo_atividade || null,
        cnpj: c.cnpj,
        logo_url: c.logo_url || null,
      }));
    },
    staleTime: 15 * 60 * 1000,
  });

  const { data: serverResults, isLoading: loadingSearch } = useQuery<CompanyOption[]>({
    queryKey: ['quote-companies-search', debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch || debouncedSearch.length < 2) return [];
      const [byRazao, byNomeFantasia] = await Promise.all([
        searchCrm<CrmCompany>('companies', 'razao_social', debouncedSearch, {
          select: 'id, razao_social, nome_fantasia, ramo_atividade, cnpj, logo_url',
          limit: 50,
        }),
        searchCrm<CrmCompany>('companies', 'nome_fantasia', debouncedSearch, {
          select: 'id, razao_social, nome_fantasia, ramo_atividade, cnpj, logo_url',
          limit: 50,
        }),
      ]);
      const seen = new Set<string>();
      const merged: CompanyOption[] = [];
      for (const c of [...byRazao, ...byNomeFantasia]) {
        if (!seen.has(c.id)) {
          seen.add(c.id);
          merged.push({
            id: c.id,
            name: getCompanyDisplayName(c),
            razao_social: c.razao_social,
            nome_fantasia: c.nome_fantasia,
            ramo_atividade: c.ramo_atividade || null,
            cnpj: c.cnpj,
            logo_url: c.logo_url || null,
          });
        }
      }
      return merged;
    },
    enabled: (debouncedSearch?.length ?? 0) >= 2,
    staleTime: 2 * 60 * 1000,
  });

  const fuse = useMemo(() => {
    if (!companies) return null;
    return new Fuse(companies, {
      keys: ['name', 'razao_social', 'nome_fantasia', 'cnpj', 'ramo_atividade'],
      threshold: 0.4,
      distance: 100,
    });
  }, [companies]);

  const filteredCompanies = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const seen = new Set<string>();
    const merged: CompanyOption[] = [];

    // 1. History (always add to 'seen' to avoid duplicates, only add to 'merged' if searching)
    if (term || history.length > 0) {
      const historyItems = term
        ? history.filter((h) => {
            const meta = (h.metadata ?? {}) as CompanyMeta;
            return (
              h.label.toLowerCase().includes(term) ||
              (meta.cnpj ?? '').includes(term) ||
              (meta.razao_social ?? '').toLowerCase().includes(term)
            );
          })
        : history;

      for (const h of historyItems) {
        if (!seen.has(h.id)) {
          if (term) {
            const meta = (h.metadata ?? {}) as CompanyMeta;
            merged.push({
              id: h.id,
              name: h.label,
              razao_social: meta.razao_social || h.label,
              nome_fantasia: h.label,
              ramo_atividade: null,
              cnpj: meta.cnpj || null,
              logo_url: meta.logo_url || null,
            });
          }
          seen.add(h.id);
        }
      }
    }

    // 2. Server Results
    if (serverResults) {
      for (const sr of serverResults) {
        if (!seen.has(sr.id)) {
          merged.push(sr);
          seen.add(sr.id);
        }
      }
    }

    // 3. Local Fuse Results / All companies if no search
    if (!term) {
      if (companies) {
        for (const c of companies) {
          if (!seen.has(c.id)) {
            merged.push(c);
            seen.add(c.id);
          }
        }
      }
    } else if (fuse) {
      for (const lr of fuse.search(searchTerm).map((r) => r.item)) {
        if (!seen.has(lr.id)) {
          merged.push(lr);
          seen.add(lr.id);
        }
      }
    }

    return merged.slice(0, 100);
  }, [companies, searchTerm, fuse, serverResults, history]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (id: string) => {
    if (id) {
      const c = (companies ?? []).concat(serverResults ?? []).find((x) => x.id === id);
      if (c) {
        addToHistory({
          id: c.id,
          label: c.name,
          type: 'company',
          metadata: { razao_social: c.razao_social, cnpj: c.cnpj, logo_url: c.logo_url },
        });
      }
    }
    onSelectCompany(id);
    setIsOpen(false);
    setSearchTerm('');
  };

  const showHistory = isOpen && history.length > 0 && !searchTerm.trim();

  if (selectedCompany && !isOpen) {
    return (
      <div
        className="group flex min-h-[44px] w-full cursor-pointer items-center gap-3 rounded-md border border-border bg-background px-3 py-2 transition-colors hover:border-primary/50"
        onClick={() => {
          onClearCompany();
          setTimeout(() => setIsOpen(true), 50);
        }}
      >
        <CompanyAvatar name={selectedCompany.name} logoUrl={selectedCompany.logo_url} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">{selectedCompany.name}</span>
          <div className="flex items-center gap-2">
            {selectedCompany.razao_social &&
              selectedCompany.razao_social !== selectedCompany.name && (
                <span className="truncate text-xs text-muted-foreground">
                  {selectedCompany.razao_social}
                </span>
              )}
            {selectedCompany.cnpj && (
              <>
                {selectedCompany.razao_social &&
                  selectedCompany.razao_social !== selectedCompany.name && (
                    <span className="text-xs text-muted-foreground">·</span>
                  )}
                <span className="font-mono text-xs text-muted-foreground">
                  {selectedCompany.cnpj}
                </span>
              </>
            )}
          </div>
        </div>
        <X className="h-4 w-4 flex-shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative z-40">
      <div className="relative isolate z-50">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus={isOpen}
          placeholder="Buscar empresa por nome, CNPJ..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => setIsOpen(true)}
          className="h-11 bg-background pl-9"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setIsOpen(false);
              setSearchTerm('');
            }
          }}
          data-testid="company-search-input"
        />
        {(loadingCompanies || loadingSearch) && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-30 bg-black/20 backdrop-blur-[2px]"
            onClick={() => {
              setIsOpen(false);
              setSearchTerm('');
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-primary/30 bg-popover shadow-xl shadow-black/25 ring-1 ring-primary/10"
          >
            <div className="flex items-center justify-between border-b border-border/50 bg-muted/30 px-3 py-2">
              <span className="text-xs font-medium text-muted-foreground">
                {loadingCompanies
                  ? 'Carregando...'
                  : searchTerm.trim().length >= 2
                    ? `${filteredCompanies.length} resultado${filteredCompanies.length !== 1 ? 's' : ''}`
                    : `${filteredCompanies.length} empresa${filteredCompanies.length !== 1 ? 's' : ''} disponíve${filteredCompanies.length !== 1 ? 'is' : 'l'}`}
              </span>
              {loadingSearch && searchTerm.length >= 2 && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  servidor...
                </span>
              )}
            </div>
            <div className="relative">
              <ScrollArea
                style={{
                  height: `${Math.min(Math.max(filteredCompanies.length + 1 + (showHistory ? history.length + 1 : 0), 2) * 56, 320)}px`,
                }}
              >
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-3 border-b border-border/30 px-3 py-2.5 text-left transition-colors duration-150 hover:bg-primary/10',
                    !companyId && 'bg-primary/5',
                  )}
                  onClick={() => handleSelect('')}
                  data-testid="no-company-option"
                >
                  <span className="text-sm text-muted-foreground">Sem empresa</span>
                </button>
                {showHistory && (
                  <div className="border-b border-border/30" data-testid="search-history-section">
                    <div className="flex items-center justify-between bg-muted/20 px-3 py-1.5">
                      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <Clock className="h-3 w-3" /> Pesquisas recentes
                      </span>
                      <button
                        type="button"
                        onClick={() => clearHistory()}
                        data-testid="clear-history-button"
                        className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" /> Limpar
                      </button>
                    </div>
                    {history.map((item) => {
                      const meta = (item.metadata ?? {}) as {
                        razao_social?: string | null;
                        cnpj?: string | null;
                        logo_url?: string | null;
                      };
                      return (
                        <div
                          key={item.id}
                          data-testid={`history-item-${item.id}`}
                          className={cn(
                            'group flex w-full items-center gap-3 border-b border-border/20 px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-primary/10',
                            companyId === item.id && 'border-l-2 border-l-primary bg-primary/10',
                          )}
                        >
                          <button
                            type="button"
                            className="flex min-w-0 flex-1 items-center gap-3"
                            onClick={() => handleSelect(item.id)}
                            data-testid={`history-item-button-${item.id}`}
                          >
                            <CompanyAvatar
                              name={item.label}
                              logoUrl={meta.logo_url ?? null}
                              size="sm"
                            />
                            <div className="flex min-w-0 flex-1 flex-col">
                              <span className="truncate text-sm font-medium">{item.label}</span>
                              {meta.cnpj && (
                                <span className="truncate font-mono text-[11px] text-muted-foreground/70">
                                  {meta.cnpj}
                                </span>
                              )}
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFromHistory(item.id);
                            }}
                            className="rounded p-1 text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                            aria-label={`Remover ${item.label} do histórico`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                {filteredCompanies.length === 0 && !loadingCompanies ? (
                  <div className="flex flex-col items-center justify-center gap-2 px-4 py-6 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/50">
                      <Building2 className="h-5 w-5 text-muted-foreground/60" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Nenhuma empresa encontrada
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground/60">
                        Tente buscar por nome, CNPJ ou ramo de atividade
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="py-0">
                    {filteredCompanies.map((company, index) => (
                      <button
                        key={company.id}
                        type="button"
                        data-testid={`company-option-${company.id}`}
                        className={cn(
                          'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-150 hover:bg-primary/10',
                          index < filteredCompanies.length - 1 && 'border-b border-border/30',
                          companyId === company.id && 'border-l-2 border-l-primary bg-primary/10',
                        )}
                        onClick={() => handleSelect(company.id)}
                      >
                        <CompanyAvatar name={company.name} logoUrl={company.logo_url} size="sm" />
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-sm font-medium">{company.name}</span>
                          <div className="flex items-center gap-1.5">
                            {company.razao_social && company.razao_social !== company.name && (
                              <span className="truncate text-xs text-muted-foreground">
                                {company.razao_social}
                              </span>
                            )}
                            {company.cnpj && (
                              <>
                                {company.razao_social && company.razao_social !== company.name && (
                                  <span className="text-xs text-muted-foreground/50">·</span>
                                )}
                                <span className="truncate font-mono text-[11px] text-muted-foreground/70">
                                  {company.cnpj}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
              {filteredCompanies.length > 4 && (
                <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-popover to-transparent" />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
