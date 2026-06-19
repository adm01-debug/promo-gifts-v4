import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getGreeting,
  getHighestRole,
  isSupervisorOrAbove,
  getRandomGreeting,
  FLOW_GREETINGS,
} from './auth-utils';
import type { AppRole } from '@/contexts/AuthContext';

describe('auth-utils', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getGreeting', () => {
    it('returns "Bom dia" for morning hours', () => {
      vi.setSystemTime(new Date(2024, 0, 1, 9, 0)); // 09:00
      expect(getGreeting()).toBe('Bom dia');
    });

    it('returns "Boa tarde" for afternoon hours', () => {
      vi.setSystemTime(new Date(2024, 0, 1, 15, 0)); // 15:00
      expect(getGreeting()).toBe('Boa tarde');
    });

    it('returns "Boa noite" for night hours', () => {
      vi.setSystemTime(new Date(2024, 0, 1, 21, 0)); // 21:00
      expect(getGreeting()).toBe('Boa noite');
    });
  });

  describe('getHighestRole', () => {
    it('returns null for empty roles', () => {
      expect(getHighestRole([])).toBeNull();
    });

    it('identifies dev as the highest role', () => {
      const roles: AppRole[] = ['agente', 'dev', 'supervisor'];
      expect(getHighestRole(roles)).toBe('dev');
    });

    it('identifies supervisor as higher than agente', () => {
      const roles: AppRole[] = ['agente', 'supervisor'];
      expect(getHighestRole(roles)).toBe('supervisor');
    });

    it('handles legacy roles (admin as supervisor)', () => {
      const roles: AppRole[] = ['admin', 'agente'];
      expect(getHighestRole(roles)).toBe('admin');
    });

    it('returns the role if only one is provided', () => {
      expect(getHighestRole(['agente'])).toBe('agente');
    });
  });

  describe('isSupervisorOrAbove', () => {
    it('returns true for dev', () => {
      expect(isSupervisorOrAbove(['dev'])).toBe(true);
    });

    it('returns true for supervisor', () => {
      expect(isSupervisorOrAbove(['supervisor'])).toBe(true);
    });

    it('returns true for legacy admin', () => {
      expect(isSupervisorOrAbove(['admin'])).toBe(true);
    });

    it('returns false for agente', () => {
      expect(isSupervisorOrAbove(['agente'])).toBe(false);
    });

    it('returns true if at least one role is supervisor or above', () => {
      expect(isSupervisorOrAbove(['agente', 'supervisor'])).toBe(true);
    });

    it('returns false for empty roles', () => {
      expect(isSupervisorOrAbove([])).toBe(false);
    });
  });

  describe('getRandomGreeting', () => {
    it('replaces name correctly even if greeting is not in template', () => {
      const name = 'John';
      // Mock Math.random to return 0.5 (should pick template 2 which has {greeting} and {name})
      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      const result = getRandomGreeting(name);
      expect(result).toContain(name);
      vi.restoreAllMocks();
    });

    it.each(FLOW_GREETINGS.map((_, index) => ({ index })))(
      'works for template index $index',
      ({ index }) => {
        const name = 'John';
        // Force specific template by mocking Math.random to a value that
        // maps to this index. T-FIX-4: cada template é um caso isolado,
        // se 1 quebrar os outros ainda rodam.
        vi.spyOn(Math, 'random').mockReturnValue(index / FLOW_GREETINGS.length + 0.01);
        const result = getRandomGreeting(name);
        expect(result).toContain(name);
        vi.restoreAllMocks();
      },
    );

    it('replaces greeting when present', () => {
      vi.setSystemTime(new Date(2024, 0, 1, 9, 0)); // 09:00 -> "Bom dia"
      const name = 'John';
      // Force first template: '{greeting}, {name}! ...'
      vi.spyOn(Math, 'random').mockReturnValue(0);

      const result = getRandomGreeting(name);
      expect(result).toContain('Bom dia');
      expect(result).toContain(name);
      vi.restoreAllMocks();
    });
  });
});
