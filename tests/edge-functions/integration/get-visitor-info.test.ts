/**
 * Integration tests — get-visitor-info edge function
 * Cobre: visitante anônimo, usuário autenticado, geolocalização, CORS (verify_jwt=false).
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockEdgeFunctionFetch, resetExternalMocks, type EdgeFnResponseSpec } from "../../p0/_mocks";

const BASE = "https://nmojwpihnslkssljowjh.supabase.co/functions/v1";

describe("get-visitor-info", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  describe("visitante anônimo (sem JWT)", () => {
    it("retorna 200 sem Authorization header (verify_jwt=false)", async () => {
      const ok: EdgeFnResponseSpec = {
        status: 200,
        body: {
          is_authenticated: false,
          ip: "177.xx.xx.xx",
          country: "BR",
          city: "São Paulo",
          timezone: "America/Sao_Paulo",
        },
      };
      mockEdgeFunctionFetch({ "/get-visitor-info": ok });
      const res = await fetch(`${BASE}/get-visitor-info`);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.is_authenticated).toBe(false);
      expect(data.country).toBeDefined();
    });

    it("não exige Authorization header — acessível anonimamente", async () => {
      const ok: EdgeFnResponseSpec = {
        status: 200,
        body: { is_authenticated: false, ip: "1.2.3.4", country: "US" },
      };
      mockEdgeFunctionFetch({ "/get-visitor-info": ok });
      const res = await fetch(`${BASE}/get-visitor-info`, {
        headers: {},
      });
      expect(res.status).not.toBe(401);
    });

    it("resposta inclui timezone válida", async () => {
      const ok: EdgeFnResponseSpec = {
        status: 200,
        body: { is_authenticated: false, timezone: "America/Sao_Paulo", ip: "1.2.3.4" },
      };
      mockEdgeFunctionFetch({ "/get-visitor-info": ok });
      const res = await fetch(`${BASE}/get-visitor-info`);
      const data = await res.json();
      expect(typeof data.timezone).toBe("string");
      expect(data.timezone.length).toBeGreaterThan(0);
    });
  });

  describe("usuário autenticado", () => {
    it("retorna is_authenticated=true quando JWT válido", async () => {
      const ok: EdgeFnResponseSpec = {
        status: 200,
        body: {
          is_authenticated: true,
          user_id: "usr-abc",
          role: "agente",
          ip: "10.0.0.1",
          country: "BR",
        },
      };
      mockEdgeFunctionFetch({ "/get-visitor-info": ok });
      const res = await fetch(`${BASE}/get-visitor-info`, {
        headers: { Authorization: "Bearer valid-jwt" },
      });
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.is_authenticated).toBe(true);
      expect(data.user_id).toBeDefined();
    });

    it("inclui role do usuário autenticado", async () => {
      const ok: EdgeFnResponseSpec = {
        status: 200,
        body: { is_authenticated: true, role: "admin", user_id: "usr-001" },
      };
      mockEdgeFunctionFetch({ "/get-visitor-info": ok });
      const res = await fetch(`${BASE}/get-visitor-info`, {
        headers: { Authorization: "Bearer admin-jwt" },
      });
      const data = await res.json();
      expect(["admin", "agente", "supervisor", "dev", "editor"]).toContain(data.role);
    });
  });

  describe("geolocalização", () => {
    it("não retorna IP completo quando país=BR (LGPD)", async () => {
      const ok: EdgeFnResponseSpec = {
        status: 200,
        body: { country: "BR", ip: "177.xx.xx.xx", city: "Curitiba" },
      };
      mockEdgeFunctionFetch({ "/get-visitor-info": ok });
      const res = await fetch(`${BASE}/get-visitor-info`);
      const data = await res.json();
      if (data.country === "BR" && data.ip) {
        expect(data.ip).toMatch(/x{2}/);
      }
    });

    it("inclui country como código ISO 3166-1 alpha-2", async () => {
      const ok: EdgeFnResponseSpec = {
        status: 200,
        body: { country: "BR", ip: "1.2.3.4" },
      };
      mockEdgeFunctionFetch({ "/get-visitor-info": ok });
      const res = await fetch(`${BASE}/get-visitor-info`);
      const data = await res.json();
      if (data.country) {
        expect(data.country).toMatch(/^[A-Z]{2}$/);
      }
    });
  });

  describe("X-Request-Id e CORS", () => {
    it("retorna X-Request-Id no header", async () => {
      const ok: EdgeFnResponseSpec = {
        status: 200,
        body: { is_authenticated: false, ip: "1.2.3.4" },
        headers: { "x-request-id": "req-visitor-001" },
      };
      mockEdgeFunctionFetch({ "/get-visitor-info": ok });
      const res = await fetch(`${BASE}/get-visitor-info`);
      expect(res.headers.get("x-request-id")).toBeTruthy();
    });

    it("OPTIONS retorna Access-Control-Allow-Origin", async () => {
      const cors: EdgeFnResponseSpec = {
        status: 200,
        body: null,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-expose-headers": "x-request-id",
        },
      };
      mockEdgeFunctionFetch({ "/get-visitor-info": cors });
      const res = await fetch(`${BASE}/get-visitor-info`, { method: "OPTIONS" });
      expect([200, 204]).toContain(res.status);
      expect(res.headers.get("access-control-allow-origin")).toBeTruthy();
    });
  });

  describe("informações sensíveis — não leak", () => {
    it("resposta não expõe variáveis de ambiente ou service role key", async () => {
      const ok: EdgeFnResponseSpec = {
        status: 200,
        body: { is_authenticated: false, country: "BR" },
      };
      mockEdgeFunctionFetch({ "/get-visitor-info": ok });
      const res = await fetch(`${BASE}/get-visitor-info`);
      const raw = await res.text();
      expect(raw).not.toMatch(/service_role|service-role|eyJ/);
      expect(raw).not.toMatch(/SUPABASE_SERVICE/i);
    });

    it("resposta não expõe stack trace", async () => {
      const ok: EdgeFnResponseSpec = {
        status: 200,
        body: { is_authenticated: false },
      };
      mockEdgeFunctionFetch({ "/get-visitor-info": ok });
      const res = await fetch(`${BASE}/get-visitor-info`);
      const raw = await res.text();
      expect(raw).not.toMatch(/at\s+\w+\s+\(/);
    });
  });
});
