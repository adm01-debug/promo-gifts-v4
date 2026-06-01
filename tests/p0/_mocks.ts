/**
 * Mocks compartilhados para os skeletons de cenários P0.
 *
 * Cada factory devolve um objeto descartável e tipado, evitando vazar estado
 * entre testes. Importe apenas o que precisar — os testes ainda estão `.skip`,
 * mas os mocks já refletem o contrato esperado das integrações externas.
 */
import { vi } from "vitest";

/* ------------------------------------------------------------------ */
/* Supabase client (browser SDK)                                       */
/* ------------------------------------------------------------------ */

export type SupabaseFnInvokeResult<T = unknown> = {
  data: T | null;
  error: { message: string; status?: number } | null;
};

export function createSupabaseClientMock(overrides: Partial<{
  invoke: (name: string, body?: unknown) => Promise<SupabaseFnInvokeResult>;
  rpc: (name: string, args?: unknown) => Promise<SupabaseFnInvokeResult>;
  fromSelect: () => Promise<SupabaseFnInvokeResult<unknown[]>>;
  user: { id: string; email: string } | null;
}> = {}) {
  const invoke = overrides.invoke ?? (async () => ({ data: null, error: null }));
  const rpc = overrides.rpc ?? (async () => ({ data: null, error: null }));
  const fromSelect = overrides.fromSelect ?? (async () => ({ data: [], error: null }));

  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: overrides.user ?? null },
        error: null,
      })),
      getSession: vi.fn(async () => ({
        data: { session: overrides.user ? { user: overrides.user } : null },
        error: null,
      })),
      signOut: vi.fn(async () => ({ error: null })),
    },
    functions: {
      invoke: vi.fn(invoke),
    },
    rpc: vi.fn(rpc),
    from: vi.fn(() => ({
      select: vi.fn(() => ({ then: (cb: (v: unknown) => unknown) => fromSelect().then(cb) })),
      insert: vi.fn(async () => ({ data: null, error: null })),
      update: vi.fn(async () => ({ data: null, error: null })),
      delete: vi.fn(async () => ({ data: null, error: null })),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
      single: vi.fn(async () => ({ data: null, error: null })),
    })),
  };
}

/* ------------------------------------------------------------------ */
/* Edge function HTTP fetch (Deno runtime mocked via global fetch)      */
/* ------------------------------------------------------------------ */

export interface EdgeFnResponseSpec {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
  delayMs?: number;
}

export function mockEdgeFunctionFetch(byPath: Record<string, EdgeFnResponseSpec>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
    const url = !input ? "" : typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
    const match = Object.entries(byPath).find(([path]) => url.includes(path));
    if (!match) {
      return new Response(JSON.stringify({ error: "Not mocked: " + url }), { status: 501 });
    }
    const spec = match[1];
    if (spec.delayMs) await new Promise(r => setTimeout(r, spec.delayMs));
    return new Response(JSON.stringify(spec.body), {
      status: spec.status,
      headers: { "Content-Type": "application/json", ...(spec.headers ?? {}) },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/* ------------------------------------------------------------------ */
/* Webhooks externos                                                   */
/* ------------------------------------------------------------------ */

export const bitrixWebhookOk: EdgeFnResponseSpec = {
  status: 200,
  body: { result: { ID: "12345" } },
};

export const bitrixWebhook5xx: EdgeFnResponseSpec = {
  status: 502,
  body: { error: "BAD_GATEWAY", description: "Upstream Bitrix offline" },
};

export const bitrixWebhookTimeout: EdgeFnResponseSpec = {
  status: 504,
  body: { error: "GATEWAY_TIMEOUT" },
  delayMs: 30_000,
};

export const n8nWebhookOk: EdgeFnResponseSpec = {
  status: 200,
  body: { executionId: "exec_abc123", status: "running" },
};

export const n8nWebhookFail: EdgeFnResponseSpec = {
  status: 500,
  body: { code: 0, message: "Workflow execution failed" },
};

/* ------------------------------------------------------------------ */
/* CRM / DB externo (Promobrind)                                       */
/* ------------------------------------------------------------------ */

export const crmDbBridgeOffline: EdgeFnResponseSpec = {
  status: 503,
  body: { success: false, error: "External DB unreachable" },
};

export const crmDbBridgeStale: EdgeFnResponseSpec = {
  status: 200,
  body: { success: true, data: [], stale: true, lastUpdate: "2024-01-01T00:00:00Z" },
};

/* ------------------------------------------------------------------ */
/* Cloudflare Stream (vídeos)                                          */
/* ------------------------------------------------------------------ */

export const cloudflareStreamDown: EdgeFnResponseSpec = {
  status: 530,
  body: { errors: [{ code: 530, message: "Origin DNS error" }] },
};

/* ------------------------------------------------------------------ */
/* MCP gateway                                                         */
/* ------------------------------------------------------------------ */

export const mcpGatewayUnauthorized: EdgeFnResponseSpec = {
  status: 401,
  body: { type: "auth_error", message: "Invalid X-Connection-Api-Key" },
};

/* ------------------------------------------------------------------ */
/* Helper: reset all global stubs after a test                         */
/* ------------------------------------------------------------------ */

export function resetExternalMocks() {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
}
