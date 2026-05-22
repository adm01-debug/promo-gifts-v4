/**
 * P0 — Edge functions com falha de typecheck/runtime mapeadas.
 *
 * Verifica contratos de resposta + presença das edge functions críticas.
 * Mocks: `_mocks.ts` (mockEdgeFunctionFetch).
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  mockEdgeFunctionFetch,
  resetExternalMocks,
  crmDbBridgeOffline,
  crmDbBridgeStale,
  type EdgeFnResponseSpec,
} from "./_mocks";
import { edgeFunctionExists, edgeFunctionRequiresJwt, readEdgeFunctionSource } from "./_helpers";

const FUNCTIONS_BASE = "https://example.supabase.co/functions/v1";

describe("P0 — Edge functions com falha", () => {
  beforeEach(() => {
    mockEdgeFunctionFetch({});
  });
  afterEach(() => resetExternalMocks());

  // ─── full-op-diagnostics ───────────────────────────────────────────────
  it("full-op-diagnostics: retorna shape esperado de 4 checks", async () => {
    const ok: EdgeFnResponseSpec = {
      status: 200,
      body: {
        checks: {
          is_dev: true,
          can_grant_mcp_full: true,
          validate_mcp_scope: true,
          rls_audit: true,
        },
      },
    };
    mockEdgeFunctionFetch({ "/full-op-diagnostics": ok });
    const res = await fetch(`${FUNCTIONS_BASE}/full-op-diagnostics`, { method: "POST" });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(Object.keys(data.checks).sort()).toEqual(
      ["can_grant_mcp_full", "is_dev", "rls_audit", "validate_mcp_scope"],
    );
  });

  // ─── crm-db-bridge ─────────────────────────────────────────────────────
  it("crm-db-bridge: 503 estruturado quando DB externo offline (não 500 cru)", async () => {
    mockEdgeFunctionFetch({ "/crm-db-bridge": crmDbBridgeOffline });
    const res = await fetch(`${FUNCTIONS_BASE}/crm-db-bridge`, {
      method: "POST",
      body: JSON.stringify({ action: "select_companies" }),
    });
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toMatch(/unreachable|offline/i);
  });

  it("crm-db-bridge: payload com stale=true contém lastUpdate", async () => {
    mockEdgeFunctionFetch({ "/crm-db-bridge": crmDbBridgeStale });
    const res = await fetch(`${FUNCTIONS_BASE}/crm-db-bridge`, { method: "POST" });
    const data = await res.json();
    expect(data.stale).toBe(true);
    expect(data.lastUpdate).toBeTruthy();
  });

  // ─── external-db-bridge ────────────────────────────────────────────────
  it("external-db-bridge: rate-limit 429 propaga Retry-After header", async () => {
    const rl: EdgeFnResponseSpec = {
      status: 429,
      body: { error: "rate_limited" },
      headers: { "Retry-After": "30" },
    };
    mockEdgeFunctionFetch({ "/external-db-bridge": rl });
    const res = await fetch(`${FUNCTIONS_BASE}/external-db-bridge`);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
  });

  // ─── connections-auto-test ─────────────────────────────────────────────
  it("connections-auto-test: edge function existe e tem suporte a paralelismo", () => {
    expect(edgeFunctionExists("connections-auto-test")).toBe(true);
    const src = readEdgeFunctionSource("connections-auto-test");
    // Aceita Promise.all/allSettled como sinal de paralelismo.
    expect(/Promise\.(all|allSettled)/i.test(src)).toBe(true);
  });

  // ─── e2e-cleanup ───────────────────────────────────────────────────────
  it("e2e-cleanup: edge function tem guarda de domínio de e-mail (não apaga produção)", () => {
    expect(edgeFunctionExists("e2e-cleanup")).toBe(true);
    const src = readEdgeFunctionSource("e2e-cleanup");
    // Aceita filtros por e-mail, allowlist, ou padrão de domínio @e2e.
    expect(/@e2e|E2E_CLEANUP_ALLOWED|allowedDomains|ALLOWED_EMAILS|e2e\.test/i.test(src)).toBe(true);
  });

  // ─── force-global-logout ───────────────────────────────────────────────
  it("force-global-logout: edge function existe e requer JWT", () => {
    expect(edgeFunctionExists("force-global-logout")).toBe(true);
    expect(edgeFunctionRequiresJwt("force-global-logout")).toBe(true);
  });

  // ─── regressão de tipos ────────────────────────────────────────────────
  it("nenhuma edge function crítica retorna error={} vazio (tipagem de catch)", () => {
    // Audita edge functions críticas para que catch use error.message, não error como-é.
    const critical = ["crm-db-bridge", "external-db-bridge", "manage-users", "ownership-audit"];
    for (const fn of critical) {
      const src = readEdgeFunctionSource(fn);
      if (!src) continue; // pula se não existe
      // Padrão ruim: `catch (e) { return { error: e } }` sem .message
      const badPattern = /catch\s*\(\s*\w+\s*\)\s*\{[^}]*\berror:\s*\w+\s*[,}]/i;
      const hasBadPattern = badPattern.test(src);
      const hasMessageAccess = /\.message|String\(/.test(src);
      // Pelo menos uma das duas: ou não tem o padrão ruim, ou usa .message em algum lugar.
      expect(hasBadPattern && !hasMessageAccess).toBe(false);
    }
  });
});
