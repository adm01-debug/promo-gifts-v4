import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DevInfraGate } from '../DevInfraGate';
import type { GateFlagProvider, GateValue } from '../types';
import type { AppRole } from '@/contexts/AuthContext';

class MockProvider implements GateFlagProvider {
  constructor(public value: GateValue = 'auto') {}
  getFlag() {
    return this.value;
  }
}

describe('DevInfraGate Unit Tests', () => {
  let providers: MockProvider[];
  let gate: DevInfraGate;
  const devRoles: AppRole[] = ['dev'];
  const userRoles: AppRole[] = ['agente'];

  beforeEach(() => {
    providers = [new MockProvider(), new MockProvider()];
    gate = new DevInfraGate(providers);
  });

  describe('Security & Access', () => {
    it('bloqueia acesso se o usuário não tiver roles permitidas', () => {
      providers[0].value = true; // Força true no provider
      expect(gate.shouldShow([])).toBe(false);
      expect(gate.shouldShow(userRoles)).toBe(false);
    });

    it('permite acesso se o usuário tiver role "dev"', () => {
      expect(gate.shouldShow(devRoles)).toBe(true);
    });

    it('permite acesso se o usuário tiver role "admin"', () => {
      expect(gate.shouldShow(['admin'])).toBe(true);
    });
  });

  describe('Provider Chain & Precedence', () => {
    it('respeita a ordem dos providers (o primeiro que não for "auto" vence)', () => {
      providers[0].value = false;
      providers[1].value = true;
      expect(gate.shouldShow(devRoles)).toBe(false);

      gate.invalidateCache();
      providers[0].value = 'auto';
      expect(gate.shouldShow(devRoles)).toBe(true);
    });

    it('retorna true por padrão se todos os providers forem "auto"', () => {
      providers[0].value = 'auto';
      providers[1].value = 'auto';
      expect(gate.shouldShow(devRoles)).toBe(true);
    });
  });

  describe('Caching & Performance', () => {
    it('faz cache do resultado da avaliação', () => {
      const spy = vi.spyOn(providers[0], 'getFlag');

      gate.shouldShow(devRoles);
      gate.shouldShow(devRoles);

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('invalida o cache quando solicitado', () => {
      const spy = vi.spyOn(providers[0], 'getFlag');

      gate.shouldShow(devRoles);
      gate.invalidateCache();

      // Como invalidateCache usa debounce de 50ms, precisamos esperar
      vi.useFakeTimers();
      gate.invalidateCache();
      vi.runAllTimers();

      gate.shouldShow(devRoles);
      expect(spy).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });
  });

  describe('Subscription System', () => {
    it('notifica inscritos após invalidação do cache (com debounce)', () => {
      const listener = vi.fn();
      gate.subscribe(listener);

      vi.useFakeTimers();
      gate.invalidateCache();
      vi.runAllTimers();

      expect(listener).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });
});
