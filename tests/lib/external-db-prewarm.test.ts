import { describe, it, expect, vi, beforeEach } from 'vitest';

// Prewarm agora usa supabase.from() diretamente (Caminho B — sem bridge).
// Mock de from().select().limit() que retorna { data: [], error: null }.
const limitMock = vi.fn().mockResolvedValue({ data: [], error: null });
const selectMock = vi.fn().mockReturnValue({ limit: limitMock });
const fromMock = vi.fn().mockReturnValue({ select: selectMock });

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: fromMock },
}));

vi.mock('@/lib/logger', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('prewarmExternalDb — idempotência por sessão', () => {
  beforeEach(() => {
    vi.resetModules();
    sessionStorage.clear();
    fromMock.mockClear();
    selectMock.mockClear();
    limitMock.mockClear();
    limitMock.mockResolvedValue({ data: [], error: null });
  });

  it('não dispara invocações na 2ª chamada com oncePerSession=true', async () => {
    const mod = await import('@/lib/external-db-prewarm');

    await mod.prewarmExternalDb({ oncePerSession: true });
    const callsAfterFirst = fromMock.mock.calls.length;
    expect(callsAfterFirst).toBeGreaterThan(0); // deve ter aquecido as tabelas

    await mod.prewarmExternalDb({ oncePerSession: true });
    // Segunda chamada NÃO dispara novas queries (idempotência via sessionStorage)
    expect(fromMock.mock.calls.length).toBe(callsAfterFirst);
  });

  it('resetPrewarmSession permite re-prewarm', async () => {
    const mod = await import('@/lib/external-db-prewarm');

    await mod.prewarmExternalDb({ oncePerSession: true });
    const first = fromMock.mock.calls.length;

    mod.resetPrewarmSession();
    await mod.prewarmExternalDb({ oncePerSession: true, force: true });
    // Após reset, nova chamada aquece novamente
    expect(fromMock.mock.calls.length).toBeGreaterThan(first);
  });

  it('marca sessionStorage após sucesso', async () => {
    const mod = await import('@/lib/external-db-prewarm');
    await mod.prewarmExternalDb({ oncePerSession: true });
    expect(sessionStorage.getItem('__pg_prewarm_done__')).toBe('1');
  });
});
