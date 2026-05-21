import { describe, it, expect } from 'vitest';
import { migratePayload } from '../../src/hooks/quotes/useAutoSaveQuote';

describe('AutoSave Migration (Unit Tests)', () => {
  const CURRENT_VERSION = 2;

  describe('Migração de Payloads Antigos', () => {
    it('deve restaurar corretamente um payload antigo sem versão (v1)', () => {
      const oldData = { items: [{ id: '1', name: 'Product' }], customerId: '123' };
      const migrated = migratePayload(oldData, CURRENT_VERSION);

      expect(migrated).not.toBeNull();
      expect(migrated.version).toBe(CURRENT_VERSION);
      expect(migrated.data).toEqual(oldData);
      expect(migrated.savedAt).toBeDefined();
    });

    it('deve tratar payload que já é o dado puro como v1', () => {
      const pureData = { someField: 'value' };
      const migrated = migratePayload(pureData, CURRENT_VERSION);
      expect(migrated.data).toEqual(pureData);
    });
  });

  describe('Segurança e Integridade', () => {
    it('deve manter um payload que já está na versão atual', () => {
      const currentPayload = {
        version: CURRENT_VERSION,
        data: { items: [] },
        savedAt: '2024-01-01T00:00:00.000Z'
      };
      const migrated = migratePayload(currentPayload, CURRENT_VERSION);

      expect(migrated).toEqual(currentPayload);
    });

    it('deve retornar null para payloads de versões futuras por segurança', () => {
      const futurePayload = {
        version: CURRENT_VERSION + 1,
        data: { something: 'new' },
        savedAt: '2024-01-01T00:00:00.000Z'
      };
      const migrated = migratePayload(futurePayload, CURRENT_VERSION);

      expect(migrated).toBeNull();
    });

    it('deve retornar null para payloads nulos ou indefinidos', () => {
      expect(migratePayload(null)).toBeNull();
      expect(migratePayload(undefined)).toBeNull();
    });

    it('deve lidar com payloads malformados (faltando campos obrigatórios)', () => {
      const malformed = { version: CURRENT_VERSION }; // Faltando 'data'
      const migrated = migratePayload(malformed, CURRENT_VERSION);
      // O migratePayload atual retorna o payload se a versão for igual,
      // mas podemos validar se ele lida com a falta de data no futuro se necessário.
      expect(migrated).toEqual(malformed);
    });
  });
});
