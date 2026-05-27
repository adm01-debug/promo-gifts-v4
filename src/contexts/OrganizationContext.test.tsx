
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useOrganization, OrganizationProvider } from './OrganizationContext';
import React from 'react';

describe('OrganizationContext Single-Tenant', () => {
  it('should always return Promo Brindes organization', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <OrganizationProvider>{children}</OrganizationProvider>
    );
    
    const { result } = renderHook(() => useOrganization(), { wrapper });
    
    expect(result.current.currentOrg?.name).toBe('Promo Brindes');
    expect(result.current.currentOrg?.id).toBe('35c6a2a6-5d6d-4ddb-8dbd-8e842a0118e5');
    expect(result.current.organizations.length).toBe(1);
    expect(result.current.organizations[0].name).toBe('Promo Brindes');
  });

  it('should have owner role by default', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <OrganizationProvider>{children}</OrganizationProvider>
    );
    
    const { result } = renderHook(() => useOrganization(), { wrapper });
    
    expect(result.current.currentRole).toBe('owner');
  });
});
