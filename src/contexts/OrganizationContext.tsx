import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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
  role: 'owner' | 'admin' | 'member';
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

const OrganizationContext = createContext<OrganizationContextType | null>(null);

const ORG_STORAGE_KEY = 'selected_org_id';

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [currentRole, setCurrentRole] = useState<OrgMember['role'] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchOrganizations = useCallback(async () => {
    if (!user) {
      setOrganizations([]);
      setCurrentOrg(null);
      setCurrentRole(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // FIX: usar user_organizations — fonte canônica das RLS policies do projeto.
      // organization_members era consultada antes mas estava vazia (0 registros),
      // resultando em currentOrg=null e orgId=null nos INSERTs → erro 42501.
      const { data: members, error: membersError } = await supabase
        .from('user_organizations')
        .select('organization_id, role')
        .eq('user_id', user.id);

      if (membersError) throw membersError;

      if (!members || members.length === 0) {
        setOrganizations([]);
        setCurrentOrg(null);
        setCurrentRole(null);
        setIsLoading(false);
        return;
      }

      const orgIds = members.map((m) => m.organization_id);

      const { data: orgs, error: orgsError } = await supabase
        .from('organizations')
        .select('*')
        .in('id', orgIds)
        .eq('is_active', true);

      if (orgsError) throw orgsError;

      const orgList = (orgs || []) as Organization[];
      setOrganizations(orgList);

      // Restore saved org or pick first
      const savedOrgId = localStorage.getItem(ORG_STORAGE_KEY);
      const savedOrg = orgList.find((o) => o.id === savedOrgId);
      const selected = savedOrg || orgList[0] || null;

      setCurrentOrg(selected);

      if (selected) {
        const membership = members.find((m) => m.organization_id === selected.id);
        setCurrentRole((membership?.role as OrgMember['role']) || null);
        localStorage.setItem(ORG_STORAGE_KEY, selected.id);
      }
    } catch (err) {
      console.error('Failed to fetch organizations:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  const switchOrganization = useCallback(
    (orgId: string) => {
      const org = organizations.find((o) => o.id === orgId);
      if (org) {
        setCurrentOrg(org);
        localStorage.setItem(ORG_STORAGE_KEY, orgId);
        // FIX: usar user_organizations consistentemente
        supabase
          .from('user_organizations')
          .select('role')
          .eq('organization_id', orgId)
          .eq('user_id', user?.id ?? '')
          .single()
          .then(({ data }) => {
            setCurrentRole((data?.role as OrgMember['role']) || null);
          });
      }
    },
    [organizations, user],
  );

  const createOrganization = useCallback(
    async (name: string, slug: string): Promise<Organization | null> => {
      if (!user) return null;

      // Use atomic RPC to create org + add owner in a single transaction
      const { data: orgId, error } = await supabase.rpc('create_organization_with_owner', {
        _name: name,
        _slug: slug,
      });

      if (error) {
        console.error('Failed to create organization:', error);
        return null;
      }

      await fetchOrganizations();
      switchOrganization(orgId);

      // Return the org from the freshly fetched list
      return (
        organizations.find((o) => o.id === orgId) || ({ id: orgId, name, slug } as Organization)
      );
    },
    [user, fetchOrganizations, switchOrganization, organizations],
  );

  return (
    <OrganizationContext.Provider
      value={{
        organizations,
        currentOrg,
        currentRole,
        isLoading,
        switchOrganization,
        createOrganization,
        refetch: fetchOrganizations,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const ctx = useContext(OrganizationContext);
  if (!ctx) {
    throw new Error('useOrganization must be used within OrganizationProvider');
  }
  return ctx;
}
