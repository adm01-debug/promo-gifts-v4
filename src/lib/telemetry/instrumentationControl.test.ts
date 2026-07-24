import { beforeEach, describe, expect, it, vi } from 'vitest';

const STORAGE_KEY = 'lov:instrumentation:paused';

type MockStorage = {
  getItem: ReturnType<typeof vi.fn>;
  setItem: ReturnType<typeof vi.fn>;
  removeItem: ReturnType<typeof vi.fn>;
};

function installLocalStorage(overrides?: Partial<MockStorage>): MockStorage {
  const storage: MockStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    ...overrides,
  };

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: storage,
  });

  return storage;
}

async function loadModule() {
  vi.resetModules();
  return import('./instrumentationControl');
}

describe('instrumentationControl storage contract', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('assume pausado quando valor estiver ausente e persiste "1"', async () => {
    const storage = installLocalStorage({ getItem: vi.fn(() => null) });
    const mod = await loadModule();

    expect(mod.isInstrumentationPaused()).toBe(true);
    expect(storage.setItem).toHaveBeenCalledWith(STORAGE_KEY, '1');
  });

  it('interpreta "0" como ativo', async () => {
    const storage = installLocalStorage({ getItem: vi.fn(() => '0') });
    const mod = await loadModule();

    expect(mod.isInstrumentationPaused()).toBe(false);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('interpreta "1" como pausado', async () => {
    const storage = installLocalStorage({ getItem: vi.fn(() => '1') });
    const mod = await loadModule();

    expect(mod.isInstrumentationPaused()).toBe(true);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('tolera exceções de storage (leitura e escrita)', async () => {
    installLocalStorage({
      getItem: vi.fn(() => {
        throw new Error('read failed');
      }),
      setItem: vi.fn(() => {
        throw new Error('write failed');
      }),
    });

    const mod = await loadModule();
    expect(mod.isInstrumentationPaused()).toBe(true);
    expect(() => mod.setInstrumentationPaused(false)).not.toThrow();
  });
});
