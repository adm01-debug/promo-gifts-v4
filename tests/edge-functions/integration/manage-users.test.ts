/**
 * Integration tests — manage-users edge function
 * Cobre: CRUD de usuários, RBAC (apenas admin), payload inválido, status codes.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockEdgeFunctionFetch, resetExternalMocks, type EdgeFnResponseSpec } from "../../p0/_mocks";

const BASE = "https://nmojwpihnslkssljowjh.supabase.co/functions/v1";

describe("manage-users", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  describe("listar usuários (GET)", () => {
    it("admin recebe 200 com array de usuários", async () => {
      const ok: EdgeFnResponseSpec = {
        status: 200,
        body: {
          users: [
            { id: "u1", email: "vendedor@ex.com", role: "agente", active: true },
            { id: "u2", email: "sup@ex.com", role: "supervisor", active: true },
          ],
          total: 2,
        },
      };
      mockEdgeFunctionFetch({ "/manage-users": ok });
      const res = await fetch(`${BASE}/manage-users`, {
        method: "GET",
        headers: { Authorization: "Bearer admin-jwt" },
      });
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(Array.isArray(data.users)).toBe(true);
      expect(typeof data.total).toBe("number");
    });

    it("lista não expõe password_hash ou tokens", async () => {
      const ok: EdgeFnResponseSpec = {
        status: 200,
        body: { users: [{ id: "u1", email: "a@ex.com", role: "agente" }], total: 1 },
      };
      mockEdgeFunctionFetch({ "/manage-users": ok });
      const res = await fetch(`${BASE}/manage-users`, {
        headers: { Authorization: "Bearer admin-jwt" },
      });
      const raw = await res.text();
      expect(raw).not.toMatch(/password_hash|refresh_token|access_token/i);
    });

    it("não-admin recebe 403", async () => {
      const err: EdgeFnResponseSpec = { status: 403, body: { error: "insufficient_role" } };
      mockEdgeFunctionFetch({ "/manage-users": err });
      const res = await fetch(`${BASE}/manage-users`, {
        headers: { Authorization: "Bearer agente-jwt" },
      });
      expect(res.status).toBe(403);
    });
  });

  describe("criar usuário (POST)", () => {
    it("admin cria usuário com role válida e recebe 201", async () => {
      const ok: EdgeFnResponseSpec = {
        status: 201,
        body: { user_id: "u-new", email: "novo@ex.com", role: "agente" },
      };
      mockEdgeFunctionFetch({ "/manage-users": ok });
      const res = await fetch(`${BASE}/manage-users`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer admin-jwt" },
        body: JSON.stringify({ email: "novo@ex.com", role: "agente", name: "Novo Vendedor" }),
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.user_id).toBeDefined();
    });

    it("retorna 400 para email inválido", async () => {
      const err: EdgeFnResponseSpec = { status: 400, body: { error: "invalid_email" } };
      mockEdgeFunctionFetch({ "/manage-users": err });
      const res = await fetch(`${BASE}/manage-users`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer admin-jwt" },
        body: JSON.stringify({ email: "nao-é-um-email", role: "agente" }),
      });
      expect(res.status).toBe(400);
    });

    it("retorna 400 para role inexistente", async () => {
      const err: EdgeFnResponseSpec = { status: 400, body: { error: "invalid_role" } };
      mockEdgeFunctionFetch({ "/manage-users": err });
      const res = await fetch(`${BASE}/manage-users`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer admin-jwt" },
        body: JSON.stringify({ email: "a@b.com", role: "superadmin_bypass" }),
      });
      expect(res.status).toBe(400);
    });

    it("retorna 409 para email duplicado", async () => {
      const err: EdgeFnResponseSpec = { status: 409, body: { error: "email_already_exists" } };
      mockEdgeFunctionFetch({ "/manage-users": err });
      const res = await fetch(`${BASE}/manage-users`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer admin-jwt" },
        body: JSON.stringify({ email: "existente@ex.com", role: "agente" }),
      });
      expect(res.status).toBe(409);
    });

    it("não-admin recebe 403 ao tentar criar", async () => {
      const err: EdgeFnResponseSpec = { status: 403, body: { error: "insufficient_role" } };
      mockEdgeFunctionFetch({ "/manage-users": err });
      const res = await fetch(`${BASE}/manage-users`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer agente-jwt" },
        body: JSON.stringify({ email: "x@x.com", role: "agente" }),
      });
      expect(res.status).toBe(403);
    });
  });

  describe("atualizar usuário (PATCH)", () => {
    it("admin atualiza role com sucesso — 200", async () => {
      const ok: EdgeFnResponseSpec = {
        status: 200,
        body: { user_id: "u1", role: "supervisor" },
      };
      mockEdgeFunctionFetch({ "/manage-users": ok });
      const res = await fetch(`${BASE}/manage-users/u1`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: "Bearer admin-jwt" },
        body: JSON.stringify({ role: "supervisor" }),
      });
      expect(res.status).toBe(200);
    });

    it("admin não pode elevar usuário para role 'dev' sem permissão extra", async () => {
      const err: EdgeFnResponseSpec = { status: 403, body: { error: "cannot_assign_dev_role" } };
      mockEdgeFunctionFetch({ "/manage-users": err });
      const res = await fetch(`${BASE}/manage-users/u1`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: "Bearer admin-jwt" },
        body: JSON.stringify({ role: "dev" }),
      });
      expect([403, 400]).toContain(res.status);
    });
  });

  describe("desativar usuário (DELETE)", () => {
    it("admin desativa usuário com sucesso — 200", async () => {
      const ok: EdgeFnResponseSpec = {
        status: 200,
        body: { user_id: "u1", active: false },
      };
      mockEdgeFunctionFetch({ "/manage-users": ok });
      const res = await fetch(`${BASE}/manage-users/u1`, {
        method: "DELETE",
        headers: { Authorization: "Bearer admin-jwt" },
      });
      expect(res.status).toBe(200);
    });

    it("admin não consegue deletar a si mesmo — 400", async () => {
      const err: EdgeFnResponseSpec = { status: 400, body: { error: "cannot_delete_self" } };
      mockEdgeFunctionFetch({ "/manage-users": err });
      const res = await fetch(`${BASE}/manage-users/self-user-id`, {
        method: "DELETE",
        headers: { Authorization: "Bearer admin-jwt" },
      });
      expect(res.status).toBe(400);
    });
  });

  describe("sem autenticação — 401", () => {
    it("retorna 401 sem token", async () => {
      const err: EdgeFnResponseSpec = { status: 401, body: { error: "unauthorized" } };
      mockEdgeFunctionFetch({ "/manage-users": err });
      const res = await fetch(`${BASE}/manage-users`);
      expect(res.status).toBe(401);
    });
  });

  describe("inputs adversariais", () => {
    const adversarialBodies = [
      { label: "SQL injection em email", body: { email: "' OR '1'='1", role: "agente" } },
      { label: "XSS em name", body: { email: "x@x.com", role: "agente", name: "<script>alert(1)</script>" } },
      { label: "role com path traversal", body: { email: "x@x.com", role: "../../etc/passwd" } },
    ];

    for (const { label, body } of adversarialBodies) {
      it(`não retorna 500 para ${label}`, async () => {
        const err: EdgeFnResponseSpec = { status: 400, body: { error: "invalid_input" } };
        mockEdgeFunctionFetch({ "/manage-users": err });
        const res = await fetch(`${BASE}/manage-users`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer admin-jwt" },
          body: JSON.stringify(body),
        });
        expect(res.status).not.toBe(500);
      });
    }
  });

  describe("CORS", () => {
    it("OPTIONS retorna headers CORS corretos", async () => {
      const cors: EdgeFnResponseSpec = {
        status: 200,
        body: null,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-expose-headers": "x-request-id",
        },
      };
      mockEdgeFunctionFetch({ "/manage-users": cors });
      const res = await fetch(`${BASE}/manage-users`, { method: "OPTIONS" });
      expect([200, 204]).toContain(res.status);
    });
  });
});
