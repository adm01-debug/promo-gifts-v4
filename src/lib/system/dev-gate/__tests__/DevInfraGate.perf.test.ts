import { describe, it, expect, beforeEach } from 'vitest';
import { DevInfraGate } from '../DevInfraGate';
import { type GateFlagProvider } from '../types';
import { type AppRole } from '@/contexts/AuthContext';

class SpyProvider implements GateFlagProvider {
  public callCount = 0;
  getFlag() {
    this.callCount++;
    return 'auto' as const;
  }
}

describe('DevInfraGate Performance Validation', () => {
  let provider: SpyProvider;
  let gate: DevInfraGate;

  beforeEach(() => {
    provider = new SpyProvider();
    gate = new DevInfraGate([provider]);
  });

  it('deve usar lookup O(1) para múltiplas roles sem degradar performance', () => {
    const roles: AppRole[] = ['dev', 'supervisor', 'admin'];

    const start = performance.now();
    for (let i = 0; i < 10000; i++) {
      gate.hasAccess(roles);
    }
    const end = performance.now();

    // Verificação funcional
    expect(gate.hasAccess(roles)).toBe(true);
    expect(gate.hasAccess(['agente'])).toBe(false);

    // O tempo deve ser extremamente baixo para 10k iterações (normalmente < 2ms)
    expect(end - start).toBeLessThan(50);
  });

  it('deve evitar ordenação de array em casos de role única (atalho de cache key)', () => {
    const singleRole: AppRole[] = ['dev'];

    // Primeira chamada enche o cache
    gate.shouldShow(singleRole);
    expect(provider.callCount).toBe(1);

    // Chamadas subsequentes devem bater no cache instantaneamente
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      gate.shouldShow(singleRole);
    }
    const end = performance.now();

    expect(provider.callCount).toBe(1); // Provider não deve ser chamado novamente
    expect(end - start).toBeLessThan(50);
  });

  it('deve manter integridade referencial do cache com múltiplas roles', () => {
    const roles: AppRole[] = ['admin', 'dev']; // Ordem específica

    gate.shouldShow(roles);
    expect(provider.callCount).toBe(1);

    // Mesmas roles em ordem diferente devem resultar na mesma cache key (devido ao sort interno)
    gate.shouldShow(['dev', 'admin']);
    expect(provider.callCount).toBe(1); // Cache hit
  });

  it('deve validar o cache estático do EnvGateProvider (simulação)', () => {
    // Testamos se o mecanismo de cache interno da classe DevInfraGate para o provider de ambiente funciona
    gate.shouldShow(['dev']);
    expect(provider.callCount).toBe(1);

    gate.shouldShow(['dev']);
    expect(provider.callCount).toBe(1); // Cache do DevInfraGate segurou

    gate.invalidateCache();
    gate.shouldShow(['dev']);
    expect(provider.callCount).toBe(2); // Invalidação funcionou
  });
});
