/**
 * Lightweight hook that returns the current organization ID.
 * Use this in hooks/services that don't need the full OrganizationContext.
 */
import { useOrganization } from '@/contexts/OrganizationContext';

export function useCurrentOrgId(): string | null {
  const { currentOrg } = useOrganization();
  return currentOrg?.id ?? null;
}
