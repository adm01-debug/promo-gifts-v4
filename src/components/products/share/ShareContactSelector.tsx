import { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, User, Search, X, Loader2, Phone, Check, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { searchCrm, selectCrm } from '@/lib/crm-db';
import type { CrmContact, CrmContactEmail, CrmContactPhone } from '@/types/crm';

interface CompanyOption {
  id: string;
  name: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
}

interface ContactOption {
  id: string;
  name: string;
  cargo: string | null;
  email: string | null;
  phone: string | null;
}

export interface ShareContactSelection {
  companyId: string;
  companyName: string;
  contactId?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
}

interface ShareContactSelectorProps {
  onSelect: (selection: ShareContactSelection | null) => void;
  selection: ShareContactSelection | null;
}

export function ShareContactSelector({ onSelect, selection }: ShareContactSelectorProps) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<CompanyOption | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Search companies
  const { data: companies = [], isLoading: loadingCompanies } = useQuery({
    queryKey: ['share-company-search', debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch || debouncedSearch.length < 2) return [];
      const results = await searchCrm<{
        id: string;
        razao_social?: string;
        nome_fantasia?: string;
        cnpj?: string;
        logo_url?: string;
      }>('companies', 'razao_social', debouncedSearch, {
        select: 'id, razao_social, nome_fantasia, cnpj, logo_url',
        limit: 10,
      });
      return results.map(
        (c: { id: string; razao_social?: string; nome_fantasia?: string; cnpj?: string }) => ({
          id: c.id,
          name: c.nome_fantasia || (c.razao_social ?? ''),
          razao_social: c.razao_social,
          nome_fantasia: c.nome_fantasia,
          cnpj: c.cnpj,
        }),
      ) as CompanyOption[];
    },
    enabled: debouncedSearch.length >= 2,
    staleTime: 60_000,
  });

  // Fetch contacts for selected company
  const { data: contacts = [], isLoading: loadingContacts } = useQuery({
    queryKey: ['share-contacts', selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany) return [];
      const raw = await selectCrm<CrmContact>('contacts', {
        select: 'id, first_name, last_name, full_name, cargo',
        filters: { company_id: selectedCompany.id },
        limit: 20,
      });

      const enriched = await Promise.all(
        raw.map(async (c) => {
          let email: string | null = null;
          let phone: string | null = null;
          const displayName = c.full_name || [c.first_name, c.last_name].filter(Boolean).join(' ');
          try {
            const emails = await selectCrm<CrmContactEmail>('contact_emails', {
              select: 'email',
              filters: { contact_id: c.id, is_primary: true },
              limit: 1,
            });
            email = emails[0]?.email ?? null;
          } catch {
            /* empty */
          }
          try {
            const phones = await selectCrm<CrmContactPhone>('contact_phones', {
              select: 'numero',
              filters: { contact_id: c.id, is_primary: true },
              limit: 1,
            });
            phone = phones[0]?.numero ?? null;
          } catch {
            /* empty */
          }
          return { id: c.id, name: displayName, cargo: c.cargo, email, phone };
        }),
      );
      return enriched;
    },
    enabled: !!selectedCompany,
    staleTime: 60_000,
  });

  const handleSelectCompany = (company: CompanyOption) => {
    setSelectedCompany(company);
    setSearch('');
    setShowDropdown(false);
    onSelect({ companyId: company.id, companyName: company.name });
  };

  const handleSelectContact = (contact: ContactOption) => {
    if (!selectedCompany) return;
    onSelect({
      companyId: selectedCompany.id,
      companyName: selectedCompany.name,
      contactId: contact.id,
      contactName: contact.name,
      contactPhone: contact.phone ?? undefined,
      contactEmail: contact.email ?? undefined,
    });
  };

  const handleClear = () => {
    setSelectedCompany(null);
    setSearch('');
    onSelect(null);
  };

  const phoneError = useMemo(() => {
    if (!selection?.contactPhone) return null;
    const digits = selection.contactPhone.replace(/\D/g, '');
    if (digits.length < 10) return 'Telefone muito curto (mínimo 10 dígitos)';
    if (digits.length > 13) return 'Telefone muito longo';
    return null;
  }, [selection?.contactPhone]);

  const handlePhoneChange = (newPhone: string) => {
    if (!selection) return;
    onSelect({
      ...selection,
      contactPhone: newPhone,
    });
  };

  // If we have a selection, show it
  if (selection?.companyId && (selectedCompany || selection.companyName)) {
    return (
      <div className="space-y-3">
        {/* Company badge */}
        <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 p-2">
          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{selection.companyName}</p>
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Contact selection */}
        {loadingContacts ? (
          <div className="flex items-center gap-2 p-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Carregando contatos...
          </div>
        ) : contacts.length > 0 ? (
          <div className="space-y-2">
            <ScrollArea className="max-h-32">
              <div className="space-y-1">
                {contacts.map((contact) => {
                  const isSelected = selection.contactId === contact.id;
                  return (
                    <button
                      key={contact.id}
                      type="button"
                      onClick={() => handleSelectContact(contact)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md p-2 text-left text-sm transition-colors',
                        isSelected ? 'border border-primary/30 bg-primary/10' : 'hover:bg-accent',
                      )}
                    >
                      <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <span className="font-medium">{contact.name}</span>
                        {contact.cargo && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            · {contact.cargo}
                          </span>
                        )}
                      </div>
                      {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                    </button>
                  );
                })}
              </div>
            </ScrollArea>

            {selection.contactId && (
              <div className="mt-2 space-y-2 rounded-lg border border-border/40 bg-card p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Telefone de Contato
                  </span>
                  {phoneError && (
                    <span className="flex items-center gap-1 text-[10px] font-medium text-destructive">
                      <AlertCircle className="h-3 w-3" /> {phoneError}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Phone className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={selection.contactPhone ?? ''}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      placeholder="(00) 00000-0000"
                      className={cn(
                        'h-9 pl-8 text-sm',
                        phoneError && 'border-destructive focus-visible:ring-destructive',
                      )}
                    />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Normalizado:{' '}
                  <span className="font-mono">
                    {selection.contactPhone?.replace(/\D/g, '') || '-'}
                  </span>
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="p-2 text-xs text-muted-foreground">Nenhum contato encontrado</p>
        )}
      </div>
    );
  }

  // Search mode
  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar empresa do CRM..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => search.length >= 2 && setShowDropdown(true)}
          className="h-9 pl-8 text-sm"
        />
      </div>

      {showDropdown && debouncedSearch.length >= 2 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          {loadingCompanies ? (
            <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando...
            </div>
          ) : companies.length > 0 ? (
            <ScrollArea className="max-h-48">
              {companies.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelectCompany(c)}
                  className="flex w-full items-center gap-2 p-2.5 text-left text-sm hover:bg-accent"
                >
                  <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.name}</p>
                    {c.cnpj && <p className="text-xs text-muted-foreground">{c.cnpj}</p>}
                  </div>
                </button>
              ))}
            </ScrollArea>
          ) : (
            <p className="p-3 text-sm text-muted-foreground">Nenhuma empresa encontrada</p>
          )}
        </div>
      )}
    </div>
  );
}
