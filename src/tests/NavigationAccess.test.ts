import { describe, it, expect } from 'vitest';
import { isNavItemActive } from '../lib/navigation/active-match';
import { isDevOnlyPath, isAdminOnlyPath } from '../lib/navigation/restricted-routes';

describe('Daily Scenario: Navigation & Access RBAC Simulation', () => {
  it('Scenario 1: Sidebar item active state during navigation', () => {
    // Exact match
    expect(isNavItemActive('/', '/')).toBe(true);
    expect(isNavItemActive('/orcamentos', '/')).toBe(false);

    // Subpath match (e.g. quote detail)
    expect(isNavItemActive('/orcamentos/123', '/orcamentos')).toBe(true);

    // False positive prevention
    expect(isNavItemActive('/orcamentos-v2', '/orcamentos')).toBe(false);
  });

  it('Scenario 2: Technical route identification for Devs', () => {
    // Technical routes should be dev-only
    expect(isDevOnlyPath('/admin/telemetria')).toBe(true);
    expect(isDevOnlyPath('/admin/conexoes')).toBe(true);

    // Non-technical admin routes
    expect(isDevOnlyPath('/admin/usuarios')).toBe(false);
    expect(isAdminOnlyPath('/admin/usuarios')).toBe(true);
  });
});
