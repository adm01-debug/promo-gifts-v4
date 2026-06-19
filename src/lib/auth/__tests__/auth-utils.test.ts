import { describe, it, expect } from 'vitest';
import { getHighestRole, isSupervisorOrAbove } from '../auth-utils';
import type { AppRole } from '@/contexts/AuthContext';

describe('auth-utils regression tests', () => {
  describe('getHighestRole', () => {
    it('should return the highest role based on hierarchy (dev > supervisor > agente)', () => {
      expect(getHighestRole(['agente', 'dev', 'supervisor'] as AppRole[])).toBe('dev');
      expect(getHighestRole(['agente', 'supervisor'] as AppRole[])).toBe('supervisor');
      expect(getHighestRole(['vendedor', 'agente'] as AppRole[])).toBe('agente');
    });

    it('should handle legacy aliases (admin/manager as supervisor)', () => {
      expect(getHighestRole(['admin', 'agente'] as AppRole[])).toBe('admin');
      expect(getHighestRole(['manager', 'supervisor'] as AppRole[])).toBe('supervisor');
    });

    it('should return null for empty roles', () => {
      expect(getHighestRole([])).toBeNull();
    });
  });

  describe('isSupervisorOrAbove', () => {
    it('should return true for dev or supervisor', () => {
      expect(isSupervisorOrAbove(['dev'] as AppRole[])).toBe(true);
      expect(isSupervisorOrAbove(['supervisor'] as AppRole[])).toBe(true);
    });

    it('should return true for legacy aliases (admin, manager)', () => {
      expect(isSupervisorOrAbove(['admin'] as AppRole[])).toBe(true);
      expect(isSupervisorOrAbove(['manager'] as AppRole[])).toBe(true);
    });

    it('should return false for agente or vendedor', () => {
      expect(isSupervisorOrAbove(['agente'] as AppRole[])).toBe(false);
      expect(isSupervisorOrAbove(['vendedor'] as AppRole[])).toBe(false);
    });

    it('should return false for empty roles', () => {
      expect(isSupervisorOrAbove([])).toBe(false);
    });
  });
});
