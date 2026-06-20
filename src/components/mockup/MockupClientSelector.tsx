/**
 * MockupClientSelector — Campo unificado de busca + seleção de empresa
 * Um único input que filtra e mostra resultados inline (sem botão separado)
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { useClientFuzzySearch } from '@/hooks/common';
import { X, Building2, Search, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCrmInfiniteCompanySelector } from '@/hooks/crm';
import { m as motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import type { MockupClient } from './MockupConfigPanel';

interface MockupClientSelectorProps {
  selectedClient: MockupClient | null;
  onClientSelect: (client: MockupClient | null) => void;
}

function CompanyAvatar({
  name,
  logoUrl,
  size = 'md',
}: {
  name: string;
  logoUrl?: string | null;
  size?: 'sm' | 'md';
}) {
  const dim = size === 'sm' ? 'w-7 h-7 text-[10px]' : 'w-8 h-8 text-xs';

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        className={cn(
          dim,
          'flex-shrink-0 rounded-full border border-border bg-background object-cover',
        )}
        loading="lazy"
      />
    );
  }

  return (
    <div
      className={cn(
        dim,
        'flex flex-shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground',
      )}
    >
      {name.substring(0, 2).toUpperCase()}
    </div>
  );
}

export function MockupClientSelector({
  selectedClient,
  onClientSelect,
}: MockupClientSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isError,
    error,
    refetch,
  } = useCrmInfiniteCompanySelector();

  const errorMessage = error instanceof Error ? error.message : null;

  const allCompanies = useMemo(() => {
    return data?.pages.flatMap((page) => page.records) ?? [];
  }, [data]);

  const { results: filteredCompanies } = useClientFuzzySearch(allCompanies, searchQuery);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const showDropdown = isFocused && !selectedClient;

  // Se há empresa selecionada, mostrar chip
  if (selectedClient) {
    return (
      <div
        className="group flex min-h-[44px] w-full cursor-pointer items-center gap-3 rounded-md border border-border bg-background px-3 py-2 transition-colors hover:border-primary/50"
        data-testid="mockup-client-chip"
        onClick={() => {
          onClientSelect(null);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
      >
        <CompanyAvatar name={selectedClient.name} logoUrl={selectedClient.logo_url} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">{selectedClient.name}</span>
          <div className="flex items-center gap-2">
            {selectedClient.ramo && (
              <span className="truncate text-xs text-muted-foreground">{selectedClient.ramo}</span>
            )}
            {selectedClient.cnpj && (
              <>
                {selectedClient.ramo && <span className="text-xs text-muted-foreground">·</span>}
                <span className="font-mono text-xs text-muted-foreground">
                  {selectedClient.cnpj}
                </span>
              </>
            )}
          </div>
        </div>
        <X className="h-4 w-4 flex-shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    );
  }

  // Altura dinâmica: max 5 itens visíveis (~56px cada) ou o que houver
  const itemHeight = 56;
  const maxVisibleItems = 5;
  const dynamicHeight = Math.min(filteredCompanies.length, maxVisibleItems) * itemHeight;
  const dropdownHeight = isError
    ? 140
    : filteredCompanies.length === 0
      ? 80
      : Math.max(dynamicHeight, 80);

  return (
    <div ref={containerRef} className="relative z-40 w-full" data-testid="mockup-client-selector">
      {/* Campo de busca — z-50 + isolate para ficar acima do backdrop-blur */}
      <div className="relative isolate z-50">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          data-testid="mockup-client-search-input"
          placeholder="Buscar empresa..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          className="h-11 bg-background pl-9"
        />
        {isLoading ? (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" />
        ) : (
          searchQuery.length > 0 && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Limpar busca de cliente"
              className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )
        )}
      </div>

      {/* Backdrop overlay — positioned below the search input */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-30 bg-black/20 backdrop-blur-[2px]"
            onClick={() => setIsFocused(false)}
          />
        )}
      </AnimatePresence>

      {/* Dropdown de resultados */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-primary/30 bg-popover shadow-xl shadow-black/25 ring-1 ring-primary/10"
          >
            {/* Header com contagem */}
            <div className="flex items-center justify-between border-b border-border/50 bg-muted/30 px-3 py-2">
              <span className="text-xs font-medium text-muted-foreground">
                {isLoading
                  ? 'Carregando...'
                  : isError
                    ? 'Erro no carregamento'
                    : searchQuery.trim().length >= 2
                      ? `${filteredCompanies.length} resultado${filteredCompanies.length !== 1 ? 's' : ''}`
                      : `${filteredCompanies.length} empresa${filteredCompanies.length !== 1 ? 's' : ''} disponíve${filteredCompanies.length !== 1 ? 'is' : 'l'}`}
              </span>
            </div>

            {/* Lista com scroll */}
            <div className="relative">
              <ScrollArea style={{ height: `${dropdownHeight}px` }}>
                {isError ? (
                  <div className="flex flex-col items-center justify-center gap-3 px-4 py-8 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                      <AlertCircle className="h-6 w-6 text-destructive" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">Falha ao carregar CRM</p>
                      <p className="mx-auto max-w-[260px] text-xs text-muted-foreground">
                        Não conseguimos conectar ao banco de dados externo agora.
                      </p>
                      {errorMessage && (
                        <p className="mx-auto mt-1 max-w-[260px] break-all font-mono text-[10px] text-destructive/80">
                          {errorMessage}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Refetch preserva o estado atual da query (incluindo searchQuery que está fora da queryKey)
                        refetch();
                      }}
                      className="mt-1 h-8 gap-2 border-destructive/20 transition-colors hover:bg-destructive/5 hover:text-destructive"
                    >
                      <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
                      {isLoading ? 'Tentando...' : 'Tentar novamente'}
                    </Button>
                  </div>
                ) : filteredCompanies.length === 0 ? (
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
                  <div className="py-1">
                    {filteredCompanies.map((company, index) => (
                      <button
                        key={company.id}
                        type="button"
                        data-testid={`mockup-client-option-${company.id}`}
                        className={cn(
                          'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-150',
                          'hover:bg-primary/10 focus-visible:bg-primary/10 focus-visible:outline-none',
                          index < filteredCompanies.length - 1 && 'border-b border-border/30',
                        )}
                        onClick={() => {
                          onClientSelect({
                            id: company.id,
                            name: company.name,
                            razao_social: company.razao_social ?? undefined,
                            nome_fantasia: company.nome_fantasia ?? undefined,
                            ramo: company.ramo ?? undefined,
                            logo_url: company.logo_url ?? undefined,
                            cnpj: company.cnpj ?? undefined,
                          });
                          setSearchQuery('');
                          setIsFocused(false);
                        }}
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
                {hasNextPage && (
                  <div className="flex justify-center border-t border-border/30 p-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-full text-[11px] text-muted-foreground hover:text-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        fetchNextPage();
                      }}
                      disabled={isFetchingNextPage}
                    >
                      {isFetchingNextPage ? (
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      ) : searchQuery ? (
                        'Buscar em mais registros...'
                      ) : (
                        'Carregar mais empresas...'
                      )}
                    </Button>
                  </div>
                )}
              </ScrollArea>

              {/* Fade gradient no bottom quando há scroll */}
              {filteredCompanies.length > maxVisibleItems && (
                <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-popover to-transparent" />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
