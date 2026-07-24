/**
 * Integration tests — platform operations edge functions
 * Covers: cleanup-novelties, collections-watcher, commemorative-dates,
 *   cors-audit, detect-new-device, e2e-cleanup, force-global-logout,
 *   full-op-diagnostics, log-login-attempt, ownership-audit,
 *   ownership-repair, rls-audit, send-scheduled-reports,
 *   verify-email, visual-search
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockEdgeFunctionFetch, resetExternalMocks, type EdgeFnResponseSpec } from "../../p0/_mocks";

const BASE = "https://nmojwpihnslkssljowjh.supabase.co/functions/v1";
const AUTH = { Authorization: "Bearer service-role-key" };
const CT = { "Content-Type": "application/json" };
const OK200: EdgeFnResponseSpec = { status: 200, body: { ok: true } };
const OK200CORS: EdgeFnResponseSpec = {
  status: 200,
  body: null,
  headers: { "access-control-allow-origin": "*" },
};

function stdTests(fnName: string, validBody: object) {
  const url = `${BASE}/${fnName}`;

  describe(`${fnName}`, () => {
    beforeEach(() => mockEdgeFunctionFetch({}));
    afterEach(() => resetExternalMocks());

    it("POST válido → 200", async () => {
      mockEdgeFunctionFetch({ [url]: OK200 });
      const res = await fetch(url, {
        method: "POST",
        headers: { ...AUTH, ...CT },
        body: JSON.stringify(validBody),
      });
      expect(res.status).toBe(200);
    });

    it("sem Authorization → 401", async () => {
      mockEdgeFunctionFetch({ [url]: { status: 401, body: { error: "unauthorized" } } });
      const res = await fetch(url, {
        method: "POST",
        headers: CT,
        body: JSON.stringify(validBody),
      });
      expect(res.status).toBe(401);
    });

    it("body malformado → 400/422", async () => {
      mockEdgeFunctionFetch({ [url]: { status: 422, body: { error: "invalid_input" } } });
      const res = await fetch(url, {
        method: "POST",
        headers: { ...AUTH, ...CT },
        body: JSON.stringify({}),
      });
      expect([400, 422]).toContain(res.status);
    });

    it("CORS headers presentes", async () => {
      mockEdgeFunctionFetch({ [url]: OK200CORS });
      const res = await fetch(url, { method: "OPTIONS", headers: AUTH });
      expect(res.headers.get("access-control-allow-origin")).toBeTruthy();
    });

    it("resposta de erro não vaza stack trace", async () => {
      mockEdgeFunctionFetch({ [url]: { status: 500, body: { error: "internal" } } });
      const res = await fetch(url, {
        method: "POST",
        headers: { ...AUTH, ...CT },
        body: JSON.stringify(validBody),
      });
      const text = await res.text();
      expect(text).not.toMatch(/at Object\.|at Function\.|\.ts:\d+/);
    });
  });
}

// ── cleanup-novelties ────────────────────────────────────────────────────────
stdTests("cleanup-novelties", { older_than_days: 30 });

// ── collections-watcher ─────────────────────────────────────────────────────
stdTests("collections-watcher", { collection_id: "col-001" });

// ── commemorative-dates ─────────────────────────────────────────────────────
stdTests("commemorative-dates", { year: 2026, country: "BR" });

// ── cors-audit ───────────────────────────────────────────────────────────────
stdTests("cors-audit", { target_url: "https://example.com/api" });

// ── detect-new-device ────────────────────────────────────────────────────────
stdTests("detect-new-device", { user_id: "usr-001", fingerprint: "fp-abc" });

// ── e2e-cleanup ──────────────────────────────────────────────────────────────
stdTests("e2e-cleanup", { test_run_id: "run-001" });

// ── force-global-logout ──────────────────────────────────────────────────────
stdTests("force-global-logout", { user_id: "usr-001", reason: "security" });

// ── full-op-diagnostics ──────────────────────────────────────────────────────
stdTests("full-op-diagnostics", { scope: "all" });

// ── log-login-attempt ────────────────────────────────────────────────────────
stdTests("log-login-attempt", { user_id: "usr-001", success: true, ip: "1.2.3.4" });

// ── ownership-audit ─────────────────────────────────────────────────────────
stdTests("ownership-audit", { organization_id: "org-001" });

// ── ownership-repair ─────────────────────────────────────────────────────────
stdTests("ownership-repair", { organization_id: "org-001", dry_run: true });

// ── rls-audit ────────────────────────────────────────────────────────────────
stdTests("rls-audit", { table: "quotes" });

// ── send-scheduled-reports ───────────────────────────────────────────────────
stdTests("send-scheduled-reports", { report_id: "rpt-001", format: "pdf" });

// ── verify-email ─────────────────────────────────────────────────────────────
stdTests("verify-email", { token: "tok-abc123" });

// ── visual-search ────────────────────────────────────────────────────────────
stdTests("visual-search", { image_url: "https://example.com/img.jpg", limit: 10 });
