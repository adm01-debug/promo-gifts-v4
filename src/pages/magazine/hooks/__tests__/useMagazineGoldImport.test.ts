/**
 * Testes de useMagazineGoldImport — foco no fallback silencioso para
 * respostas 401/403 da edge `magazine-import-local`.
 *
 * Contrato validado:
 *  1. 401 → NÃO lança, encerra silenciosamente, marca migrated (não reentra).
 *  2. 403 → mesmo comportamento.
 *  3. 500 (não-auth) → NÃO marca migrated (tenta de novo em outra sessão).
 *  4. Após 401, rehidratar o hook não dispara nova chamada (idempotência).
 *  5. Logs incluem `status`, `request_id` (header X-Request-Id) e `error_code`
 *     do body — cobre a correlação para diagnóstico rápido.
 *  6. Sem localStorage legado → não bate na edge, marca migrated direto.
 *  7. Sessão ausente → não bate na edge, não marca migrated.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// --- Mock fetch ---
type FetchReply =
  | { kind: 'ok'; body: unknown }
  | { kind: 'status'; status: number; body?: unknown; requestIdHeader?: string };

const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
let importReply: FetchReply = { kind: 'ok', body: { results: [] } };

function makeResponse(reply: FetchReply): Promise<Response> {
  if (reply.kind === 'ok') {
    return Promise.resolve(
      new Response(JSON.stringify(reply.body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (reply.requestIdHeader) headers['x-request-id'] = reply.requestIdHeader;
  return Promise.resolve(
    new Response(JSON.stringify(reply.body ?? { error: `http_${reply.status}` }), {
      status: reply.status,
      headers,
    }),
  );
}

const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input.toString();
  fetchCalls.push({ url, init });
  if (url.includes('magazine-import-local')) return makeResponse(importReply);
  return new Response('{}', { status: 200 });
});
globalThis.fetch = fetchMock as unknown as typeof fetch;

// --- Mock sonner ---
const toastCalls: Array<{ level: string; title: string }> = [];
vi.mock('sonner', () => ({
  toast: {
    success: (title: string) => toastCalls.push({ level: 'success', title }),
    error: (title: string) => toastCalls.push({ level: 'error', title }),
    warn: (title: string) => toastCalls.push({ level: 'warn', title }),
  },
}));

// --- Mock logger — captura eventos para asserts de diagnóstico ---
interface CapturedLog {
  level: 'debug' | 'error' | 'info' | 'warn';
  event: string;
  fields?: Record<string, unknown>;
}
const capturedLogs: CapturedLog[] = [];
vi.mock('@/lib/telemetry/structuredLogger', () => ({
  createClientLogger: () => ({
    scope: 'magazine.gold-import',
    requestId: 'test-req-id',
    debug: (event: string, fields?: Record<string, unknown>) =>
      capturedLogs.push({ level: 'debug', event, fields }),
    info: (event: string, fields?: Record<string, unknown>) =>
      capturedLogs.push({ level: 'info', event, fields }),
    warn: (event: string, fields?: Record<string, unknown>) =>
      capturedLogs.push({ level: 'warn', event, fields }),
    error: (event: string, fields?: Record<string, unknown>) =>
      capturedLogs.push({ level: 'error', event, fields }),
    child: () => ({}) as never,
    headers: () => ({}),
  }),
}));

// --- Mock supabase lazy client (auth.getSession) ---
let sessionToken: string | null = 'valid-access-token';
vi.mock('@/integrations/supabase/lazy-client', () => ({
  getSupabaseClient: async () => ({
    auth: {
      getSession: async () => ({
        data: { session: sessionToken ? { access_token: sessionToken } : null },
      }),
    },
  }),
}));

// Importa DEPOIS dos mocks
import { useMagazineGoldImport } from '../useMagazineGoldImport';

const LEGACY_KEY = 'promobrind.magazines.v1';
const MIGRATED_KEY = 'promobrind.magazines.migratedToGold.v1';
const USER_ID = 'user-123';

function makeLegacyMagazine(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'mag_legacy_1',
    ownerId: USER_ID,
    title: 'Revista Legada',
    subtitle: '',
    templateId: 'editorial-vogue',
    branding: {},
    content: {},
    status: 'draft',
    items: [],
    ...overrides,
  };
}

function resetAll() {
  localStorage.clear();
  fetchCalls.length = 0;
  toastCalls.length = 0;
  capturedLogs.length = 0;
  fetchMock.mockClear();
  importReply = { kind: 'ok', body: { results: [] } };
  sessionToken = 'valid-access-token';
}

beforeEach(() => resetAll());
afterEach(() => vi.clearAllTimers());

describe('useMagazineGoldImport — fallback 401/403', () => {
  it('401 → encerra silenciosamente, marca migrated, não relança', async () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify([makeLegacyMagazine()]));
    importReply = {
      kind: 'status',
      status: 401,
      body: { error: 'unauthorized', request_id: 'req-401-xyz' },
      requestIdHeader: 'req-401-xyz',
    };

    const { result } = renderHook(() => useMagazineGoldImport(USER_ID));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.importing).toBe(false));

    // Não lançou, importing = false, migrated marcado
    expect(localStorage.getItem(MIGRATED_KEY)).toBe('1');
    expect(toastCalls.filter((t) => t.level === 'error')).toHaveLength(0);

    // Log de diagnóstico com status + request_id + error_code
    const failedLog = capturedLogs.find((l) => l.event === 'magazine_import_local_failed');
    expect(failedLog).toBeDefined();
    expect(failedLog?.fields).toMatchObject({
      status: 401,
      request_id: 'req-401-xyz',
      error_code: 'unauthorized',
    });

    // Log de skip por auth
    expect(capturedLogs.some((l) => l.event === 'magazine_import_local_skipped_auth')).toBe(true);
  });

  it('403 → mesmo comportamento (marca migrated)', async () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify([makeLegacyMagazine()]));
    importReply = {
      kind: 'status',
      status: 403,
      body: { error: 'forbidden', request_id: 'req-403-abc' },
    };

    renderHook(() => useMagazineGoldImport(USER_ID));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(localStorage.getItem(MIGRATED_KEY)).toBe('1'));

    const failedLog = capturedLogs.find((l) => l.event === 'magazine_import_local_failed');
    expect(failedLog?.fields).toMatchObject({ status: 403, request_id: 'req-403-abc' });
  });

  it('500 (não-auth) → NÃO marca migrated (tenta de novo depois)', async () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify([makeLegacyMagazine()]));
    importReply = { kind: 'status', status: 500, body: { error: 'boom' } };

    renderHook(() => useMagazineGoldImport(USER_ID));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    // Aguarda o hook estabilizar sem marcar migrated
    await new Promise((r) => setTimeout(r, 20));
    expect(localStorage.getItem(MIGRATED_KEY)).toBeNull();
  });

  it('após 401, novo mount NÃO chama a edge de novo (loop guard)', async () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify([makeLegacyMagazine()]));
    importReply = { kind: 'status', status: 401, body: { error: 'unauthorized' } };

    const first = renderHook(() => useMagazineGoldImport(USER_ID));
    await waitFor(() => expect(localStorage.getItem(MIGRATED_KEY)).toBe('1'));
    first.unmount();

    fetchMock.mockClear();
    fetchCalls.length = 0;

    renderHook(() => useMagazineGoldImport(USER_ID));
    // Como migrated=1, o hook deve retornar cedo sem tocar em fetch
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sem localStorage legado → marca migrated direto, não chama edge', async () => {
    // localStorage vazio
    renderHook(() => useMagazineGoldImport(USER_ID));
    await waitFor(() => expect(localStorage.getItem(MIGRATED_KEY)).toBe('1'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sem sessão → não chama edge, não marca migrated', async () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify([makeLegacyMagazine()]));
    sessionToken = null;

    renderHook(() => useMagazineGoldImport(USER_ID));

    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorage.getItem(MIGRATED_KEY)).toBeNull();
  });

  it('extrai request_id do header quando o body não é JSON válido', async () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify([makeLegacyMagazine()]));
    // Body malformado — header ainda deve ser lido
    importReply = {
      kind: 'status',
      status: 401,
      body: 'not-json' as unknown as Record<string, unknown>,
      requestIdHeader: 'req-header-only',
    };

    renderHook(() => useMagazineGoldImport(USER_ID));

    await waitFor(() =>
      expect(capturedLogs.some((l) => l.event === 'magazine_import_local_failed')).toBe(true),
    );
    const failedLog = capturedLogs.find((l) => l.event === 'magazine_import_local_failed');
    expect(failedLog?.fields?.status).toBe(401);
    // request_id vem do header quando body falha
    expect(failedLog?.fields?.request_id).toBe('req-header-only');
  });
});
