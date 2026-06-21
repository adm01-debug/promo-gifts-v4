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
    // id canônico de produção (organizations.id) — deve bater com o banco para a RLS de quotes
    expect(result.current.currentOrg?.id).toBe('5db5aee1-064b-4ef4-9193-345dcd8274ea');
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
