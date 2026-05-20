import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const mockUseOrganization = vi.fn();

vi.mock('@/contexts/OrganizationContext', () => ({
  useOrganization: (...args: any[]) => mockUseOrganization(...args),
}));

import { useCurrentOrgId } from '@/hooks/common/useCurrentOrgId';

describe('useCurrentOrgId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns current org id', () => {
    mockUseOrganization.mockReturnValue({
      currentOrg: { id: 'org-123', name: 'Test Org' },
      organizations: [{ id: 'org-123', name: 'Test Org' }],
      currentRole: 'member',
      isLoading: false,
      switchOrganization: vi.fn(),
      createOrganization: vi.fn(),
      refetch: vi.fn(),
    });
    const { result } = renderHook(() => useCurrentOrgId());
    expect(result.current).toBe('org-123');
  });

  it('returns null when no org selected', () => {
    mockUseOrganization.mockReturnValue({
      currentOrg: null,
      organizations: [],
      currentRole: null,
      isLoading: false,
      switchOrganization: vi.fn(),
      createOrganization: vi.fn(),
      refetch: vi.fn(),
    });
    const { result } = renderHook(() => useCurrentOrgId());
    expect(result.current).toBeNull();
  });
});
