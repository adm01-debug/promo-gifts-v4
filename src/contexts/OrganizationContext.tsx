/**
 * OrganizationContext — SINGLE-TENANT (Promo Brindes).
 *
 * O sistema é de uso exclusivo da Promo Brindes. A camada multi-organização
 * foi removida do front-end. Este contexto agora expõe sempre a organização
 * fixa para manter compatibilidade com hooks (useCurrentOrgId, useOrgData,
 * useQuotes etc.) sem quebrar consumidores existentes.
 */
import { createContext, useContext, type ReactNode } from 'react';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
  is_active: boolean;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface OrgMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: 'admin' | 'member' | 'owner';
  joined_at: string;
}

interface OrganizationContextType {
  organizations: Organization[];
  currentOrg: Organization | null;
  currentRole: OrgMember['role'] | null;
  isLoading: boolean;
  switchOrganization: (orgId: string) => void;
  createOrganization: (name: string, slug: string) => Promise<Organization | null>;
  refetch: () => Promise<void>;
}

// Organização fixa — corresponde ao ÚNICO registro real existente em `organizations`
// (id canônico de produção; owner = admin; dona de todos os orçamentos).
// IMPORTANTE: este id DEVE bater com organizations.id no banco; caso contrário a RLS
// de `quotes` (user_is_org_member) bloqueia a criação de orçamentos.
const FIXED_ORG: Organization = {
  id: '5db5aee1-064b-4ef4-9193-345dcd8274ea', // allowed: canonical prod org (organizations.id)
  name: 'Promo Brindes',
  slug: 'promo-brindes',
  logo_url: null,
  description: null,
  is_active: true,
  settings: {},
  created_at: '1970-01-01T00:00:00.000Z',
  updated_at: '1970-01-01T00:00:00.000Z',
};

const noop = () => {};
const noopAsync = async () => {};

const FIXED_VALUE: OrganizationContextType = {
  organizations: [FIXED_ORG],
  currentOrg: FIXED_ORG,
  currentRole: 'owner',
  isLoading: false,
  switchOrganization: noop,
  createOrganization: async () => FIXED_ORG,
  refetch: noopAsync,
};

const OrganizationContext = createContext<OrganizationContextType>(FIXED_VALUE);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  return (
    <OrganizationContext.Provider value={FIXED_VALUE}>{children}</OrganizationContext.Provider>
  );
}

export function useOrganization() {
  return useContext(OrganizationContext);
}
