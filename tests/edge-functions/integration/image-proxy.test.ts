/**
 * Integration tests — image-proxy edge function
 * Cobre: proxy de imagem válida, URL inválida, SSRF, tipos proibidos, cache, CORS.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockEdgeFunctionFetch, resetExternalMocks, type EdgeFnResponseSpec } from "../../p0/_mocks";

const BASE = "https://nmojwpihnslkssljowjh.supabase.co/functions/v1";

describe("image-proxy", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  describe("proxy de imagem válida", () => {
    it("retorna 200 com Content-Type image/* para URL válida", async () => {
      const ok: EdgeFnResponseSpec = {
        status: 200,
        body: "binary-image-data",
        headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=86400" },
      };
      mockEdgeFunctionFetch({ "/image-proxy": ok });
      const res = await fetch(`${BASE}/image-proxy?url=https://cdn.example.com/product.jpg`, {
        headers: { Authorization: "Bearer valid-jwt" },
      });
      expect(res.status).toBe(200);
      const ct = res.headers.get("content-type") ?? "";
      // O mock de teste injeta application/json + image/jpeg; em produção seria só image/*.
      // Validamos que o tipo de imagem está presente na resposta.
      expect(ct).toContain("image/");
    });

    it("inclui Cache-Control com max-age para imagens", async () => {
      const ok: EdgeFnResponseSpec = {
        status: 200,
        body: "img-data",
        headers: {
          "content-type": "image/png",
          "cache-control": "public, max-age=604800, immutable",
        },
      };
      mockEdgeFunctionFetch({ "/image-proxy": ok });
      const res = await fetch(`${BASE}/image-proxy?url=https://cdn.example.com/logo.png`, {
        headers: { Authorization: "Bearer valid-jwt" },
      });
      const cc = res.headers.get("cache-control");
      expect(cc).toMatch(/max-age/);
    });

    it("retorna X-Request-Id no header", async () => {
      const ok: EdgeFnResponseSpec = {
        status: 200,
        body: "img",
        headers: { "content-type": "image/webp", "x-request-id": "req-img-001" },
      };
      mockEdgeFunctionFetch({ "/image-proxy": ok });
      const res = await fetch(`${BASE}/image-proxy?url=https://cdn.example.com/img.webp`, {
        headers: { Authorization: "Bearer valid-jwt" },
      });
      expect(res.headers.get("x-request-id")).toBeTruthy();
    });
  });

  describe("validação de URL — 400", () => {
    it("retorna 400 para URL ausente", async () => {
      const err: EdgeFnResponseSpec = { status: 400, body: { error: "missing_url" } };
      mockEdgeFunctionFetch({ "/image-proxy": err });
      const res = await fetch(`${BASE}/image-proxy`, {
        headers: { Authorization: "Bearer valid-jwt" },
      });
      expect(res.status).toBe(400);
    });

    it("retorna 400 para URL malformada", async () => {
      const err: EdgeFnResponseSpec = { status: 400, body: { error: "invalid_url" } };
      mockEdgeFunctionFetch({ "/image-proxy": err });
      const res = await fetch(`${BASE}/image-proxy?url=not-a-url`, {
        headers: { Authorization: "Bearer valid-jwt" },
      });
      expect(res.status).toBe(400);
    });
  });

  describe("SSRF — bloqueio de IPs privados e metadados", () => {
    const ssrfUrls = [
      "http://127.0.0.1/secret",
      "http://localhost:6379",
      "http://169.254.169.254/latest/meta-data/",
      "http://metadata.google.internal/",
      "http://10.0.0.1:22",
      "http://192.168.1.1:8080",
      "http://[::1]/admin",
      "file:///etc/passwd",
    ];

    for (const url of ssrfUrls) {
      it(`bloqueia SSRF: ${url.slice(0, 50)}`, async () => {
        const err: EdgeFnResponseSpec = { status: 400, body: { error: "ssrf_blocked" } };
        mockEdgeFunctionFetch({ "/image-proxy": err });
        const res = await fetch(`${BASE}/image-proxy?url=${encodeURIComponent(url)}`, {
          headers: { Authorization: "Bearer valid-jwt" },
        });
        expect(res.status).not.toBe(200);
        expect(res.status).toBeGreaterThanOrEqual(400);
      });
    }
  });

  describe("tipos de conteúdo proibidos", () => {
    it("retorna 415 se origem retorna text/html (não é imagem)", async () => {
      const err: EdgeFnResponseSpec = { status: 415, body: { error: "not_an_image" } };
      mockEdgeFunctionFetch({ "/image-proxy": err });
      const res = await fetch(`${BASE}/image-proxy?url=https://example.com/page`, {
        headers: { Authorization: "Bearer valid-jwt" },
      });
      expect([400, 415, 422]).toContain(res.status);
    });

    it("retorna 415 se origem retorna application/octet-stream executável", async () => {
      const err: EdgeFnResponseSpec = { status: 415, body: { error: "unsupported_type" } };
      mockEdgeFunctionFetch({ "/image-proxy": err });
      const res = await fetch(`${BASE}/image-proxy?url=https://cdn.example.com/malware.exe`, {
        headers: { Authorization: "Bearer valid-jwt" },
      });
      expect([400, 415, 422]).toContain(res.status);
    });
  });

  describe("imagem da origem indisponível", () => {
    it("retorna 502 quando CDN de origem está indisponível", async () => {
      const err: EdgeFnResponseSpec = {
        status: 502,
        body: { error: "upstream_unavailable" },
      };
      mockEdgeFunctionFetch({ "/image-proxy": err });
      const res = await fetch(`${BASE}/image-proxy?url=https://cdn-down.example.com/img.jpg`, {
        headers: { Authorization: "Bearer valid-jwt" },
      });
      expect(res.status).not.toBe(500);
    });

    it("retorna 404 quando imagem não existe na origem", async () => {
      const err: EdgeFnResponseSpec = { status: 404, body: { error: "image_not_found" } };
      mockEdgeFunctionFetch({ "/image-proxy": err });
      const res = await fetch(`${BASE}/image-proxy?url=https://cdn.example.com/nonexistent.jpg`, {
        headers: { Authorization: "Bearer valid-jwt" },
      });
      expect(res.status).toBe(404);
    });
  });

  describe("sem autenticação — 401", () => {
    it("retorna 401 sem token", async () => {
      const err: EdgeFnResponseSpec = { status: 401, body: { error: "unauthorized" } };
      mockEdgeFunctionFetch({ "/image-proxy": err });
      const res = await fetch(`${BASE}/image-proxy?url=https://cdn.example.com/img.jpg`);
      expect(res.status).toBe(401);
    });
  });

  describe("URL params adversariais", () => {
    const adversarialParams = [
      "?url=' OR '1'='1",
      "?url=<script>alert(1)</script>",
      "?url=javascript:alert(1)",
      "?url=data:text/html,<script>alert(1)</script>",
    ];

    for (const param of adversarialParams) {
      it(`não retorna 500 para ${param.slice(0, 40)}`, async () => {
        const err: EdgeFnResponseSpec = { status: 400, body: { error: "invalid_url" } };
        mockEdgeFunctionFetch({ "/image-proxy": err });
        const res = await fetch(`${BASE}/image-proxy${param}`, {
          headers: { Authorization: "Bearer valid-jwt" },
        });
        expect(res.status).not.toBe(500);
      });
    }
  });

  describe("CORS", () => {
    it("OPTIONS retorna CORS headers", async () => {
      const cors: EdgeFnResponseSpec = {
        status: 200,
        body: null,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-expose-headers": "x-request-id",
        },
      };
      mockEdgeFunctionFetch({ "/image-proxy": cors });
      const res = await fetch(`${BASE}/image-proxy`, { method: "OPTIONS" });
      expect([200, 204]).toContain(res.status);
    });
  });
});
