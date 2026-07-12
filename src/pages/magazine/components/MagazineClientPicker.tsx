/**
 * MagazineClientPicker — busca empresas do CRM (is_customer=true) e
 * preenche nome + logo do cliente automaticamente. Fallback manual permanece.
 */

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, Check, Search, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { selectCrm } from '@/lib/crm-db';
import { getCompanyDisplayName, type CrmCompany } from '@/types/crm';

interface Props {
  clientName: string | null;
  clientLogoUrl: string | null;
  onChange: (patch: { clientName?: string | null; clientLogoUrl?: string | null }) => void;
}

interface Row {
  id: string;
  name: string;
  logo_url: string | null;
  cnpj: string | null;
  ramo: string | null;
}

export function MagazineClientPicker({ clientName, clientLogoUrl, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['magazine-crm-companies'],
    queryFn: async () => {
      const rows = await selectCrm<CrmCompany>('companies', {
        select: 'id, razao_social, nome_fantasia, logo_url, ramo_atividade, cnpj',
        filters: { deleted_at: null, is_customer: true },
        orderBy: { column: 'razao_social', ascending: true },
        limit: 200,
      });
      return rows.map<Row>((c) => ({
        id: c.id,
        name: getCompanyDisplayName(c),
        logo_url: c.logo_url ?? null,
        cnpj: c.cnpj ?? null,
        ramo: c.ramo_atividade ?? null,
      }));
    },
    staleTime: 15 * 60 * 1000,
  });

  const filtered = useMemo(() => {
    if (!debounced) return companies.slice(0, 40);
    const q = debounced.toLowerCase();
    return companies
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.cnpj ?? '').replace(/\D/g, '').includes(q.replace(/\D/g, '')),
      )
      .slice(0, 40);
  }, [companies, debounced]);

  const select = (row: Row) => {
    onChange({ clientName: row.name, clientLogoUrl: row.logo_url });
    setOpen(false);
  };

  const clear = () => onChange({ clientName: null, clientLogoUrl: null });

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1 justify-start gap-3 px-3"
              aria-label="Escolher cliente do CRM"
              data-testid="magazine-client-picker-trigger"
            >
              {clientLogoUrl ? (
                <img src={clientLogoUrl} alt="" className="h-6 w-6 rounded object-contain" />
              ) : (
                <Building2 className="h-4 w-4 text-muted-foreground" />
              )}
              <span className={cn('flex-1 truncate text-left', !clientName && 'text-muted-foreground')}>
                {clientName || 'Selecionar cliente do CRM'}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-96 p-0">
            <div className="border-b p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar cliente por nome ou CNPJ…"
                  className="h-9 pl-8"
                />
              </div>
            </div>
            <ScrollArea className="h-72">
              <div role="listbox" aria-label="Empresas do CRM" className="p-1">
                {isLoading && (
                  <div className="p-4 text-center text-xs text-muted-foreground">Carregando…</div>
                )}
                {!isLoading && filtered.length === 0 && (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    Nenhum cliente encontrado.
                  </div>
                )}
                {filtered.map((c) => {
                  const active = c.name === clientName;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => select(c)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-md p-2 text-left transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                        active && 'bg-primary/10',
                      )}
                    >
                      {c.logo_url ? (
                        <img src={c.logo_url} alt="" className="h-8 w-8 rounded object-contain" />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-muted-foreground">
                          <Building2 className="h-4 w-4" />
                        </div>
                      )}
                      <div className="flex-1 overflow-hidden">
                        <div className="line-clamp-1 text-sm font-medium">{c.name}</div>
                        <div className="line-clamp-1 text-xs text-muted-foreground">
                          {c.cnpj ?? '—'}
                          {c.ramo ? ` · ${c.ramo}` : ''}
                        </div>
                      </div>
                      {active && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
        {clientName && (
          <Button variant="ghost" size="icon" onClick={clear} aria-label="Remover cliente">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Lista somente empresas marcadas como clientes no CRM. Também é possível preencher manualmente
        no campo abaixo.
      </p>
    </div>
  );
}
