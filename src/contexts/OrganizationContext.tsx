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

// Organização fixa — corresponde ao único registro existente em `organizations`.
const FIXED_ORG: Organization = {
  id: '35c6a2a6-5d6d-4ddb-8dbd-8e842a0118e5', // allowed: prod org seed record
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
  // eslint-disable-next-line @typescript-eslint/require-await
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
