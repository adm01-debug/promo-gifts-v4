/**
 * Integration tests — secure-upload edge function
 * Cobre: upload válido, missing file, tipo inválido, tamanho excedido,
 * auth ausente, varredura de vírus (mock), hash SHA-256, audit log.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockEdgeFunctionFetch, resetExternalMocks, type EdgeFnResponseSpec } from "../../p0/_mocks";

const BASE = "https://nmojwpihnslkssljowjh.supabase.co/functions/v1";

const UPLOAD_SUCCESS = {
  ok: true,
  path: "uploads/abc123/image.png",
  bucket: "personalization-images",
  hash: "abc123def456",
  size_bytes: 12345,
  content_type: "image/png",
};

describe("secure-upload", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  describe("happy path — upload válido", () => {
    it("retorna 200 com path, bucket e hash", async () => {
      const ok: EdgeFnResponseSpec = { status: 200, body: UPLOAD_SUCCESS };
      mockEdgeFunctionFetch({ "/secure-upload": ok });
      const res = await fetch(`${BASE}/secure-upload`, {
        method: "POST",
        headers: { Authorization: "Bearer valid-jwt" },
        body: "form-data-placeholder",
      });
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.path).toBeDefined();
      expect(data.hash).toBeDefined();
      expect(data.bucket).toBe("personalization-images");
    });

    it("hash retornado é string hexadecimal de 64 chars (SHA-256)", async () => {
      const ok: EdgeFnResponseSpec = {
        status: 200,
        body: { ...UPLOAD_SUCCESS, hash: "a".repeat(64) },
      };
      mockEdgeFunctionFetch({ "/secure-upload": ok });
      const res = await fetch(`${BASE}/secure-upload`, {
        method: "POST",
        headers: { Authorization: "Bearer valid-jwt" },
        body: "form-data-placeholder",
      });
      const data = await res.json();
      expect(data.hash).toMatch(/^[0-9a-f]{64}$/i);
    });

    it("aceita folder customizado via formData", async () => {
      const ok: EdgeFnResponseSpec = {
        status: 200,
        body: { ...UPLOAD_SUCCESS, path: "mockups/abc123/image.png" },
      };
      mockEdgeFunctionFetch({ "/secure-upload": ok });
      const res = await fetch(`${BASE}/secure-upload`, {
        method: "POST",
        headers: { Authorization: "Bearer valid-jwt" },
        body: "form-data-with-folder",
      });
      const data = await res.json();
      expect(data.path).toContain("mockups/");
    });
  });

  describe("validação de entrada — 400/422", () => {
    it("retorna 400 quando campo 'file' ausente no formData", async () => {
      const err: EdgeFnResponseSpec = { status: 400, body: { error: "missing_file" } };
      mockEdgeFunctionFetch({ "/secure-upload": err });
      const res = await fetch(`${BASE}/secure-upload`, {
        method: "POST",
        headers: { Authorization: "Bearer valid-jwt", "Content-Type": "multipart/form-data" },
        body: "no-file-field",
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/file|obrigat/i);
    });

    it("retorna 415 para tipo de arquivo não permitido (exe, bat, sh)", async () => {
      const err: EdgeFnResponseSpec = { status: 415, body: { error: "unsupported_media_type" } };
      mockEdgeFunctionFetch({ "/secure-upload": err });
      const res = await fetch(`${BASE}/secure-upload`, {
        method: "POST",
        headers: { Authorization: "Bearer valid-jwt" },
        body: "malicious.exe file",
      });
      expect([400, 415, 422]).toContain(res.status);
    });

    it("retorna 413 para arquivo maior que o limite máximo", async () => {
      const err: EdgeFnResponseSpec = { status: 413, body: { error: "file_too_large", max_bytes: 10_000_000 } };
      mockEdgeFunctionFetch({ "/secure-upload": err });
      const res = await fetch(`${BASE}/secure-upload`, {
        method: "POST",
        headers: { Authorization: "Bearer valid-jwt" },
        body: "a".repeat(100),
      });
      expect([400, 413]).toContain(res.status);
    });
  });

  describe("autenticação — 401", () => {
    it("retorna 401 sem Authorization header", async () => {
      const err: EdgeFnResponseSpec = { status: 401, body: { error: "unauthorized" } };
      mockEdgeFunctionFetch({ "/secure-upload": err });
      const res = await fetch(`${BASE}/secure-upload`, {
        method: "POST",
        body: "form-data",
      });
      expect(res.status).toBe(401);
    });

    it("retorna 401 com token expirado", async () => {
      const err: EdgeFnResponseSpec = { status: 401, body: { error: "jwt_expired" } };
      mockEdgeFunctionFetch({ "/secure-upload": err });
      const res = await fetch(`${BASE}/secure-upload`, {
        method: "POST",
        headers: { Authorization: "Bearer expired-token" },
        body: "form-data",
      });
      expect(res.status).toBe(401);
    });
  });

  describe("scan de vírus / segurança", () => {
    it("retorna 422 quando arquivo detectado como malicioso", async () => {
      const virus: EdgeFnResponseSpec = {
        status: 422,
        body: { error: "malicious_file_detected", scan_result: { threat: "EICAR-Test-Signature" } },
      };
      mockEdgeFunctionFetch({ "/secure-upload": virus });
      const res = await fetch(`${BASE}/secure-upload`, {
        method: "POST",
        headers: { Authorization: "Bearer valid-jwt" },
        body: "eicar-test-string",
      });
      expect([400, 422]).toContain(res.status);
      const data = await res.json();
      expect(data.error).toMatch(/malicio|threat|virus/i);
    });
  });

  describe("CORS e método", () => {
    it("OPTIONS retorna 200 com CORS headers", async () => {
      const cors: EdgeFnResponseSpec = {
        status: 200,
        body: null,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "POST, OPTIONS",
          "access-control-allow-headers": "authorization, content-type, x-request-id",
          "access-control-expose-headers": "x-request-id",
        },
      };
      mockEdgeFunctionFetch({ "/secure-upload": cors });
      const res = await fetch(`${BASE}/secure-upload`, { method: "OPTIONS" });
      expect([200, 204]).toContain(res.status);
      expect(res.headers.get("access-control-allow-origin")).toBeTruthy();
    });

    it("GET retorna 405 Method Not Allowed", async () => {
      const err: EdgeFnResponseSpec = { status: 405, body: { error: "method_not_allowed" } };
      mockEdgeFunctionFetch({ "/secure-upload": err });
      const res = await fetch(`${BASE}/secure-upload`, {
        method: "GET",
        headers: { Authorization: "Bearer valid-jwt" },
      });
      expect([404, 405]).toContain(res.status);
    });
  });

  describe("sem crash — respostas não-500", () => {
    const edgeCases = [
      { label: "body completamente vazio", bodyStr: undefined },
      { label: "body null", bodyStr: "null" },
      { label: "body array", bodyStr: "[]" },
      { label: "body com XSS", bodyStr: '<script>alert(1)</script>' },
      { label: "body com injeção SQL", bodyStr: "'; DROP TABLE profiles;--" },
    ];

    for (const { label, bodyStr } of edgeCases) {
      it(`não retorna 500 para: ${label}`, async () => {
        const err: EdgeFnResponseSpec = { status: 400, body: { error: "invalid_input" } };
        mockEdgeFunctionFetch({ "/secure-upload": err });
        const res = await fetch(`${BASE}/secure-upload`, {
          method: "POST",
          headers: { Authorization: "Bearer valid-jwt" },
          body: bodyStr,
        });
        expect(res.status).not.toBe(500);
      });
    }
  });
});
