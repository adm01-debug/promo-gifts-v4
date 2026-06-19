/**
 * CompanyContactSelector — Orchestrator (refactored)
 * Sub-components in ./company-contact/
 */
import { useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, User, Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { selectCrm } from '@/lib/crm-db';
import {
  getCompanyDisplayName,
  type CrmCompany,
  type CrmContact,
  type CrmContactEmail,
  type CrmContactPhone,
} from '@/types/crm';
import { CompanySearchDropdown } from './company-contact/CompanySearchDropdown';
import { ContactDropdown, SingleContactDisplay } from './company-contact/ContactSelector';
import type { CompanyOption } from './company-contact/shared-types';

export interface SelectedCompanyInfo {
  id: string;
  name: string;
  cnpj?: string;
  ramo_atividade?: string;
}
export interface SelectedContactInfo {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  cargo?: string;
}

interface CompanyContactSelectorProps {
  companyId: string;
  contactId?: string;
  onCompanyChange: (companyId: string) => void;
  onContactChange?: (contactId: string) => void;
  onCompanyInfoChange?: (info: SelectedCompanyInfo | null) => void;
  onContactInfoChange?: (info: SelectedContactInfo | null) => void;
}

export function CompanyContactSelector({
  companyId,
  contactId,
  onCompanyChange,
  onContactChange,
  onCompanyInfoChange,
  onContactInfoChange,
}: CompanyContactSelectorProps) {
  // Fetch selected company by ID
  const { data: fetchedCompany } = useQuery<CompanyOption | null>({
    queryKey: ['quote-company-by-id', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const data = await selectCrm<CrmCompany>('companies', {
        select: 'id, razao_social, nome_fantasia, ramo_atividade, cnpj, logo_url',
        filters: { id: companyId },
        limit: 1,
      });
      if (!data.length) return null;
      const c = data[0];
      return {
        id: c.id,
        name: getCompanyDisplayName(c),
        razao_social: c.razao_social,
        nome_fantasia: c.nome_fantasia,
        ramo_atividade: c.ramo_atividade || null,
        cnpj: c.cnpj,
        logo_url: c.logo_url || null,
      };
    },
    enabled: !!companyId,
    staleTime: 10 * 60 * 1000,
  });

  // Fetch contacts for selected company
  const { data: contacts, isLoading: loadingContacts } = useQuery({
    queryKey: ['quote-company-contacts', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const contactsData = await selectCrm<CrmContact>('contacts', {
        select: 'id, first_name, last_name, full_name, cargo',
        filters: { company_id: companyId, deleted_at: null },
        orderBy: { column: 'first_name', ascending: true },
        limit: 50,
      });
      return Promise.all(
        contactsData.map(async (ct) => {
          let email: string | null = null;
          let phone: string | null = null;
          try {
            const [emails, phones] = await Promise.all([
              selectCrm<CrmContactEmail>('contact_emails', {
                filters: { contact_id: ct.id },
                limit: 1,
              }),
              selectCrm<CrmContactPhone>('contact_phones', {
                filters: { contact_id: ct.id },
                limit: 1,
              }),
            ]);
            if (emails.length > 0) email = emails[0].email;
            if (phones.length > 0) phone = phones[0].numero;
          } catch {
            /* silently fail */
          }
          return {
            id: ct.id,
            name: ct.full_name || [ct.first_name, ct.last_name].filter(Boolean).join(' '),
            cargo: ct.cargo,
            email,
            phone,
          };
        }),
      );
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  const selectedCompany = useMemo(() => fetchedCompany || null, [fetchedCompany]);

  // Propagate company info once the React Query result resolves (covers the case where
  // fetchedCompany still held the previous company when handleSelectCompany fired).
  useEffect(() => {
    if (!fetchedCompany || !companyId) return;
    if (fetchedCompany.id !== companyId) return;
    onCompanyInfoChange?.({
      id: fetchedCompany.id,
      name: fetchedCompany.name,
      cnpj: fetchedCompany.cnpj || undefined,
      ramo_atividade: fetchedCompany.ramo_atividade || undefined,
    });
    // Only re-run when the resolved company data changes, not every render of onCompanyInfoChange
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchedCompany]);

  const handleSelectCompany = (id: string) => {
    onCompanyChange(id);
    onContactChange?.('');
    onContactInfoChange?.(null);
    if (!id) {
      onCompanyInfoChange?.(null);
    }
    // onCompanyInfoChange for a valid id is handled by the useEffect above
  };

  const handleClearCompany = () => {
    onCompanyChange('');
    onContactChange?.('');
    onCompanyInfoChange?.(null);
    onContactInfoChange?.(null);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          Empresa
        </Label>
        <CompanySearchDropdown
          companyId={companyId}
          selectedCompany={selectedCompany}
          onSelectCompany={handleSelectCompany}
          onClearCompany={handleClearCompany}
        />
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <User className="h-4 w-4" />
          Contato
        </Label>
        {!companyId ? (
          <div
            className={cn(
              'flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground',
            )}
          >
            Selecione uma empresa primeiro
          </div>
        ) : loadingContacts ? (
          <div
            className={cn(
              'flex h-10 w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground',
            )}
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando...
          </div>
        ) : !contacts || contacts.length === 0 ? (
          <div
            className={cn(
              'flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground',
            )}
          >
            Nenhum contato cadastrado
          </div>
        ) : contacts.length === 1 ? (
          <SingleContactDisplay
            contact={contacts[0]}
            contactId={contactId}
            onContactChange={onContactChange}
            onContactInfoChange={onContactInfoChange}
          />
        ) : (
          <ContactDropdown
            contacts={contacts}
            contactId={contactId}
            onContactChange={onContactChange}
            onContactInfoChange={onContactInfoChange}
          />
        )}
      </div>
    </div>
  );
}
