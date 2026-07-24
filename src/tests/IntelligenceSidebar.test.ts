import { describe, it, expect } from 'vitest';
import { isNavItemActive } from '../lib/navigation/active-match';

describe('Intelligence Sidebar & UI Regression', () => {
  it('should identify intelligence routes as active correctly', () => {
    expect(isNavItemActive('/tendencias', '/tendencias')).toBe(true);
    expect(isNavItemActive('/inteligencia-comercial', '/inteligencia-comercial')).toBe(true);
    expect(isNavItemActive('/tendencias/extra', '/tendencias')).toBe(true);
  });
});
