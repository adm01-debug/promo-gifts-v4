import { describe, it, expect } from 'vitest';
import { migratePayload } from '@/hooks/quotes/useAutoSaveQuote';

// Redefining current version to match the file
const CURRENT_VERSION = 2;

describe('useAutoSaveQuote - migratePayload', () => {
  it('returns null for empty payload', () => {
    expect(migratePayload(null)).toBeNull();
    expect(migratePayload(undefined)).toBeNull();
  });

  it('migrates v1 payload (no version) to current version', () => {
    const oldData = { items: [{ id: 1 }], total: 100 };
    const migrated = migratePayload(oldData, CURRENT_VERSION);

    expect(migrated).not.toBeNull();
    expect(migrated!.version).toBe(CURRENT_VERSION);
    expect(migrated!.data).toEqual(oldData);
    expect(migrated!.savedAt).toBeDefined();
  });

  it('preserves current version payload', () => {
    const currentPayload = {
      version: CURRENT_VERSION,
      data: { test: true },
      savedAt: '2024-01-01T00:00:00.000Z',
    };
    const migrated = migratePayload(currentPayload, CURRENT_VERSION);
    expect(migrated).toEqual(currentPayload);
  });

  it('returns null for future version payload to prevent corruption', () => {
    const futurePayload = {
      version: 99,
      data: { secret: 'data' },
      savedAt: '2024-01-01T00:00:00.000Z',
    };
    const migrated = migratePayload(futurePayload, CURRENT_VERSION);
    expect(migrated).toBeNull();
  });

  it('handles custom migration versions if passed', () => {
    const oldData = { foo: 'bar' };
    const migrated = migratePayload(oldData, 3);
    expect(migrated).not.toBeNull();
    expect(migrated!.version).toBe(3);
  });
});
