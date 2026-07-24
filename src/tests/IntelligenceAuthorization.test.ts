import { describe, it, expect } from 'vitest';
import { isDevOnlyPath, isAdminOnlyPath, canNavigateTo } from '../lib/navigation/restricted-routes';
import { isRestrictedPath } from '../lib/navigation/filter-restricted-items';

describe('Market Intelligence & Trends Authorization Regression', () => {
  const routes = ['/tendencias', '/inteligencia-comercial'];
  const subRoutes = ['/tendencias/detalhes', '/inteligencia-comercial/insights'];
  const adminRoutes = ['/admin/usuarios', '/admin/cadastros', '/admin/seguranca'];
  const devRoutes = ['/admin/telemetria', '/admin/conexoes'];

  it.each(routes)('regular user can access intelligence route %s', (path) => {
    expect(isDevOnlyPath(path)).toBe(false);
    expect(isAdminOnlyPath(path)).toBe(false);
    expect(canNavigateTo(path, { isDev: false, isAdmin: false })).toBe(true);
  });

  it.each(subRoutes)('regular user can access intelligence sub-route %s', (path) => {
    expect(isDevOnlyPath(path)).toBe(false);
    expect(isAdminOnlyPath(path)).toBe(false);
    expect(canNavigateTo(path, { isDev: false, isAdmin: false })).toBe(true);
  });

  it.each(routes)('intelligence route %s is not restricted', (path) => {
    expect(isRestrictedPath(path)).toBe(false);
  });

  it.each(adminRoutes)('admin route %s stays protected from regular users', (path) => {
    expect(isAdminOnlyPath(path)).toBe(true);
    expect(canNavigateTo(path, { isDev: false, isAdmin: false })).toBe(false);
  });

  it.each(devRoutes)('dev route %s stays protected from non-dev users', (path) => {
    expect(isDevOnlyPath(path)).toBe(true);
    expect(canNavigateTo(path, { isDev: false, isAdmin: false })).toBe(false);
    expect(canNavigateTo(path, { isDev: false, isAdmin: true })).toBe(false);
  });
});
