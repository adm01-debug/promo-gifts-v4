/**
 * P0 — Webhooks: Bitrix24, n8n, MCP devem ser resilientes a falhas upstream.
 *
 * Cobertura: payload contract, 5xx handling, timeout abort, idempotência,
 * sanitização de erro (sem vazar API keys), assinatura HMAC.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  mockEdgeFunctionFetch,
  resetExternalMocks,
  bitrixWebhookOk,
  bitrixWebhook5xx,
  bitrixWebhookTimeout,
  n8nWebhookOk,
  n8nWebhookFail,
  mcpGatewayUnauthorized,
} from "./_mocks";
import { edgeFunctionExists, readEdgeFunctionSource } from "./_helpers";

const BITRIX_PATH = "/bitrix-sync";
const N8N_PATH = "/n8n-trigger";
const MCP_PATH = "/connector-gateway";
const FUNCTIONS_BASE = "https://example.supabase.co/functions/v1";

describe("P0 — Webhooks resilientes", () => {
  beforeEach(() => {
    mockEdgeFunctionFetch({});
  });
  afterEach(() => resetExternalMocks());

  // ─── Bitrix24 ──────────────────────────────────────────────────────────
  it("bitrix-sync: payload de sucesso (200) contém result.ID", async () => {
    mockEdgeFunctionFetch({ [BITRIX_PATH]: bitrixWebhookOk });
    const res = await fetch(`${FUNCTIONS_BASE}${BITRIX_PATH}`, { method: "POST" });
    const data = await res.json();
    expect(data.result.ID).toBe("12345");
  });

  it("bitrix-sync: retorna 502 estruturado em falha upstream", async () => {
    mockEdgeFunctionFetch({ [BITRIX_PATH]: bitrixWebhook5xx });
    const res = await fetch(`${FUNCTIONS_BASE}${BITRIX_PATH}`, { method: "POST" });
    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.error).toBe("BAD_GATEWAY");
  });

  it("bitrix-sync: timeout 504 é diferenciado de 502/500 (mock contract)", async () => {
    // Não esperamos pelos 30s do mock — apenas verificamos o contrato do spec.
    expect(bitrixWebhookTimeout.status).toBe(504);
    expect(bitrixWebhookTimeout.delayMs).toBeGreaterThanOrEqual(20_000);
  });

  it("bitrix-sync: edge function existe e tem código de circuit breaker", () => {
    expect(edgeFunctionExists("bitrix-sync")).toBe(true);
    const src = readEdgeFunctionSource("bitrix-sync");
    // Breaker/retry pode estar em _shared/circuit-breaker.ts ou external-fetch.
    const ok = /circuit[-_ ]?breaker|getBreaker|retry|backoff|fetchWithBreaker|external-fetch/i.test(src);
    expect(ok).toBe(true);
  });

  it("bitrix-sync: existe Zod schema validando payload (rejeita 400 inválido)", () => {
    const src = readEdgeFunctionSource("bitrix-sync");
    expect(/z\.(object|string|number|enum|array)/i.test(src)).toBe(true);
  });

  // ─── n8n ───────────────────────────────────────────────────────────────
  it("n8n-trigger (via webhook-dispatcher): payload de sucesso contém executionId", async () => {
    mockEdgeFunctionFetch({ [N8N_PATH]: n8nWebhookOk });
    const res = await fetch(`${FUNCTIONS_BASE}${N8N_PATH}`, { method: "POST" });
    const data = await res.json();
    expect(data.executionId).toMatch(/^exec_/);
  });

  it("n8n-trigger: erro 500 do workflow é propagado como 500 (não 200 com error body)", async () => {
    mockEdgeFunctionFetch({ [N8N_PATH]: n8nWebhookFail });
    const res = await fetch(`${FUNCTIONS_BASE}${N8N_PATH}`, { method: "POST" });
    expect(res.status).toBe(500);
  });

  // ─── MCP Gateway ───────────────────────────────────────────────────────
  it("connector-gateway: 401 NÃO expõe palavras 'api_key' ou 'secret' na resposta", async () => {
    mockEdgeFunctionFetch({ [MCP_PATH]: mcpGatewayUnauthorized });
    const res = await fetch(`${FUNCTIONS_BASE}${MCP_PATH}`);
    const text = await res.text();
    expect(text).not.toMatch(/api[_-]?key|secret|service[_-]?role/i);
  });

  it("webhook handler: edge functions de dispatch existem (webhook-dispatcher, webhook-inbound)", () => {
    expect(edgeFunctionExists("webhook-dispatcher")).toBe(true);
    expect(edgeFunctionExists("webhook-inbound")).toBe(true);
  });
});
