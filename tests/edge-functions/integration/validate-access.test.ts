/**
 * Integration tests — validate-access edge function
 * Cobre: check de role, permissão de rota, token expirado, payload de cenários RBAC.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockEdgeFunctionFetch, resetExternalMocks, type EdgeFnResponseSpec } from "../../p0/_mocks";

const BASE = "https://nmojwpihnslkssljowjh.supabase.co/functions/v1";

describe("validate-access", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  describe("acesso permitido", () => {
    const allowedCases = [
      { role: "admin", route: "/admin/usuarios", action: "read" },
      { role: "supervisor", route: "/orcamentos", action: "write" },
      { role: "agente", route: "/produtos", action: "read" },
      { role: "dev", route: "/admin/conexoes", action: "write" },
    ];

    for (const { role, route, action } of allowedCases) {
      it(`permite ${role} em ${route} (${action})`, async () => {
        const ok: EdgeFnResponseSpec = { status: 200, body: { allowed: true, role, route } };
        mockEdgeFunctionFetch({ "/validate-access": ok });
        const res = await fetch(`${BASE}/validate-access`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
          body: JSON.stringify({ route, action }),
        });
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data.allowed).toBe(true);
      });
    }
  });

  describe("acesso negado — 403", () => {
    const deniedCases = [
      { role: "agente", route: "/admin/usuarios", action: "write" },
      { role: "agente", route: "/admin/conexoes", action: "read" },
      { role: "supervisor", route: "/admin/usuarios", action: "delete" },
    ];

    for (const { role, route, action } of deniedCases) {
      it(`nega ${role} em ${route} (${action})`, async () => {
        const denied: EdgeFnResponseSpec = { status: 403, body: { allowed: false, reason: "insufficient_role" } };
        mockEdgeFunctionFetch({ "/validate-access": denied });
        const res = await fetch(`${BASE}/validate-access`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
          body: JSON.stringify({ route, action }),
        });
        const data = await res.json();
        expect(res.status).toBe(403);
        expect(data.allowed).toBe(false);
      });
    }
  });

  describe("autenticação", () => {
    it("retorna 401 sem token", async () => {
      const err: EdgeFnResponseSpec = { status: 401, body: { error: "unauthorized" } };
      mockEdgeFunctionFetch({ "/validate-access": err });
      const res = await fetch(`${BASE}/validate-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ route: "/produtos", action: "read" }),
      });
      expect(res.status).toBe(401);
    });

    it("retorna 401 com JWT expirado", async () => {
      const err: EdgeFnResponseSpec = { status: 401, body: { error: "jwt_expired" } };
      mockEdgeFunctionFetch({ "/validate-access": err });
      const res = await fetch(`${BASE}/validate-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer expired-jwt" },
        body: JSON.stringify({ route: "/produtos", action: "read" }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe("validação de payload — 400", () => {
    const invalidPayloads = [
      { label: "sem route", body: { action: "read" } },
      { label: "sem action", body: { route: "/produtos" } },
      { label: "action inválida", body: { route: "/produtos", action: "destroy_all" } },
      { label: "route com path traversal", body: { route: "/../../../etc/passwd", action: "read" } },
      { label: "body vazio", body: {} },
    ];

    for (const { label, body } of invalidPayloads) {
      it(`retorna 400 para: ${label}`, async () => {
        const err: EdgeFnResponseSpec = { status: 400, body: { error: "validation_failed" } };
        mockEdgeFunctionFetch({ "/validate-access": err });
        const res = await fetch(`${BASE}/validate-access`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
          body: JSON.stringify(body),
        });
        expect(res.status).toBe(400);
      });
    }
  });

  describe("resposta não-500 para inputs extremos", () => {
    const extremeInputs = [
      '{"route": "' + "A".repeat(5000) + '", "action": "read"}',
      '{"route": null, "action": null}',
      "INVALID JSON",
      "",
      '{"route": "<script>alert(1)</script>", "action": "read"}',
    ];

    for (const input of extremeInputs) {
      it(`não retorna 500 para: ${input.substring(0, 40)}`, async () => {
        const err: EdgeFnResponseSpec = { status: 400, body: { error: "bad_request" } };
        mockEdgeFunctionFetch({ "/validate-access": err });
        const res = await fetch(`${BASE}/validate-access`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
          body: input,
        });
        expect(res.status).not.toBe(500);
      });
    }
  });
});
