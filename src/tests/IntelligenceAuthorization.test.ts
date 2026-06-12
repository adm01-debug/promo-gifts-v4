import { describe, it, expect } from 'vitest';
import { isDevOnlyPath, isAdminOnlyPath, canNavigateTo } from '../lib/navigation/restricted-routes';
import { isRestrictedPath } from '../lib/navigation/filter-restricted-items';

describe('Market Intelligence & Trends Authorization Regression', () => {
  const routes = ['/tendencias', '/inteligencia-comercial'];
  const subRoutes = ['/tendencias/detalhes', '/inteligencia-comercial/insights'];

  it('should allow regular users to access intelligence routes (Frontend Rules)', () => {
    routes.forEach(path => {
      expect(isDevOnlyPath(path)).toBe(false);
      // These should no longer be admin-only
      expect(isAdminOnlyPath(path)).toBe(false);
      // canNavigateTo should return true for regular users
      expect(canNavigateTo(path, { isDev: false, isAdmin: false })).toBe(true);
    });

    subRoutes.forEach(path => {
      expect(isDevOnlyPath(path)).toBe(false);
      expect(isAdminOnlyPath(path)).toBe(false);
      expect(canNavigateTo(path, { isDev: false, isAdmin: false })).toBe(true);
    });
  });

  it('should NOT treat intelligence routes as restricted items', () => {
    routes.forEach(path => {
      expect(isRestrictedPath(path)).toBe(false);
    });
  });

  it('should keep administrative routes protected', () => {
    const adminRoutes = ['/admin/usuarios', '/admin/cadastros', '/admin/seguranca'];
    adminRoutes.forEach(path => {
      expect(isAdminOnlyPath(path)).toBe(true);
      expect(canNavigateTo(path, { isDev: false, isAdmin: false })).toBe(false);
    });

    const devRoutes = ['/admin/telemetria', '/admin/conexoes'];
    devRoutes.forEach(path => {
      expect(isDevOnlyPath(path)).toBe(true);
      expect(canNavigateTo(path, { isDev: false, isAdmin: false })).toBe(false);
      expect(canNavigateTo(path, { isDev: false, isAdmin: true })).toBe(false);
    });
  });
});
