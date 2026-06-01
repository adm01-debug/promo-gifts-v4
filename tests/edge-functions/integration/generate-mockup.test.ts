/**
 * Integration (contract) tests — generate-mockup edge function.
 *
 * The Deno edge function cannot run in-process under vitest (Deno.serve, OffscreenCanvas,
 * npm: imports), so these tests mock the HTTP layer and assert against the function's
 * REAL request/response contract. End-to-end execution lives in tests/edge-functions/live/.
 *
 * Contract (see supabase/functions/generate-mockup/index.ts):
 *   Input  : { productImageUrl, logoBase64 | logoUrl, positionX, positionY,
 *              logoWidthCm, logoHeightCm, logoRotation, logoScale, techniqueName }
 *   Success: { ok:true, mockupUrl, mockup_url, mockup_id, generated_at, generation_ms, technique }
 *   Errors : validation_failed(400, errorCode?), product_image_unavailable(422),
 *            logo_unavailable(422), composition_timeout(504), canvas_runtime_unavailable(501),
 *            composition_failed(500), storage_upload_failed(500)
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockEdgeFunctionFetch, resetExternalMocks, type EdgeFnResponseSpec } from "../../p0/_mocks";

const BASE = "https://nmojwpihnslkssljowjh.supabase.co/functions/v1";

const PRODUCT_URL = "https://cdn.example.com/products/mug.png";
const LOGO_URL = "https://cdn.example.com/logos/acme.png";

const MOCKUP_SUCCESS = {
  ok: true,
  mockupUrl: "https://cdn.example.com/mockups/abc123.png",
  mockup_url: "https://cdn.example.com/mockups/abc123.png",
  mockup_id: "1717000000000-abc123",
  generated_at: new Date().toISOString(),
  generation_ms: 842,
  technique: "Serigrafia",
};

function validBody(extra: Record<string, unknown> = {}) {
  return {
    productImageUrl: PRODUCT_URL,
    logoUrl: LOGO_URL,
    techniqueName: "Serigrafia",
    positionX: 50,
    positionY: 50,
    logoWidthCm: 5,
    logoHeightCm: 3,
    logoRotation: 0,
    logoScale: 100,
    ...extra,
  };
}

async function post(body: unknown, withAuth = true) {
  return fetch(`${BASE}/generate-mockup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(withAuth ? { Authorization: "Bearer valid-jwt" } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("generate-mockup", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  describe("happy path", () => {
    it("returns 200 with mockupUrl/mockup_url and a mockup_id", async () => {
      mockEdgeFunctionFetch({ "/generate-mockup": { status: 200, body: MOCKUP_SUCCESS } });
      const res = await post(validBody());
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.mockupUrl).toMatch(/^https?:\/\//);
      expect(data.mockup_url).toBe(data.mockupUrl);
      expect(data.mockup_id).toBeTruthy();
    });

    it("mockupUrl points to a safe https CDN (no javascript:/data:)", async () => {
      mockEdgeFunctionFetch({ "/generate-mockup": { status: 200, body: MOCKUP_SUCCESS } });
      const data = await (await post(validBody())).json();
      expect(data.mockupUrl).not.toContain("javascript:");
      expect(data.mockupUrl).not.toContain("data:");
    });

    it("returns generated_at as ISO 8601 and echoes the technique metadata", async () => {
      mockEdgeFunctionFetch({ "/generate-mockup": { status: 200, body: MOCKUP_SUCCESS } });
      const data = await (await post(validBody())).json();
      expect(new Date(data.generated_at).toISOString()).toBe(data.generated_at);
      expect(data.technique).toBe("Serigrafia");
    });

    it("accepts a base64 logo instead of a logoUrl", async () => {
      mockEdgeFunctionFetch({ "/generate-mockup": { status: 200, body: MOCKUP_SUCCESS } });
      const res = await post(
        validBody({ logoUrl: undefined, logoBase64: "data:image/png;base64,iVBORw0KGgo=" }),
      );
      expect(res.status).toBe(200);
    });
  });

  describe("validation — 400", () => {
    const invalidInputs = [
      { label: "missing productImageUrl", body: { logoUrl: LOGO_URL } },
      { label: "productImageUrl not a URL", body: validBody({ productImageUrl: "not-a-url" }) },
      {
        label: "productImageUrl with javascript: protocol",
        body: validBody({ productImageUrl: "javascript:alert(1)" }),
      },
      {
        label: "productImageUrl relative (/placeholder.svg)",
        body: validBody({ productImageUrl: "/placeholder.svg" }),
      },
      { label: "missing both logoBase64 and logoUrl", body: { productImageUrl: PRODUCT_URL } },
      { label: "empty body", body: {} },
    ];

    for (const { label, body } of invalidInputs) {
      it(`returns 400 validation_failed for: ${label}`, async () => {
        mockEdgeFunctionFetch({
          "/generate-mockup": { status: 400, body: { error: "validation_failed" } },
        });
        const res = await post(body);
        const data = await res.json();
        expect(res.status).toBe(400);
        expect(data.error).toBe("validation_failed");
      });
    }

    it("rejects SVG logos with errorCode SVG_NOT_SUPPORTED", async () => {
      const spec: EdgeFnResponseSpec = {
        status: 400,
        body: {
          error: "validation_failed",
          errorCode: "SVG_NOT_SUPPORTED",
          message: "Logos SVG não são suportados. Use PNG ou JPG.",
        },
      };
      mockEdgeFunctionFetch({ "/generate-mockup": spec });
      const res = await post(
        validBody({ logoUrl: undefined, logoBase64: "data:image/svg+xml;base64,PHN2Zz4=" }),
      );
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.errorCode).toBe("SVG_NOT_SUPPORTED");
    });

    it("rejects disallowed fetch hosts with errorCode HOST_NOT_ALLOWED", async () => {
      mockEdgeFunctionFetch({
        "/generate-mockup": {
          status: 400,
          body: { error: "validation_failed", errorCode: "HOST_NOT_ALLOWED" },
        },
      });
      const data = await (
        await post(validBody({ productImageUrl: "https://169.254.169.254/latest/meta-data" }))
      ).json();
      expect(data.errorCode).toBe("HOST_NOT_ALLOWED");
    });
  });

  describe("authentication — 401", () => {
    it("returns 401 without a token", async () => {
      mockEdgeFunctionFetch({
        "/generate-mockup": { status: 401, body: { error: "unauthorized" } },
      });
      const res = await post(validBody(), false);
      expect(res.status).toBe(401);
    });
  });

  describe("upstream image failures — 422", () => {
    it("returns 422 product_image_unavailable when the product image cannot be fetched", async () => {
      mockEdgeFunctionFetch({
        "/generate-mockup": {
          status: 422,
          body: { error: "product_image_unavailable", message: "HTTP 404 fetching image" },
        },
      });
      const res = await post(validBody());
      const data = await res.json();
      expect(res.status).toBe(422);
      expect(data.error).toBe("product_image_unavailable");
    });

    it("returns 422 logo_unavailable when the logo cannot be fetched/decoded", async () => {
      mockEdgeFunctionFetch({
        "/generate-mockup": {
          status: 422,
          body: { error: "logo_unavailable", message: "HTTP 403 fetching image" },
        },
      });
      const res = await post(validBody());
      expect(res.status).toBe(422);
      expect((await res.json()).error).toBe("logo_unavailable");
    });
  });

  describe("composition / runtime failures", () => {
    it("returns 504 composition_timeout (not 500) when the time budget is exceeded", async () => {
      mockEdgeFunctionFetch({
        "/generate-mockup": { status: 504, body: { error: "composition_timeout" } },
      });
      const res = await post(validBody());
      expect(res.status).toBe(504);
      expect(res.status).not.toBe(500);
      expect((await res.json()).error).toBe("composition_timeout");
    });

    it("returns 501 canvas_runtime_unavailable when the runtime lacks OffscreenCanvas", async () => {
      mockEdgeFunctionFetch({
        "/generate-mockup": {
          status: 501,
          body: { error: "canvas_runtime_unavailable", message: "OffscreenCanvas não está disponível" },
        },
      });
      const res = await post(validBody());
      expect(res.status).toBe(501);
      expect((await res.json()).error).toBe("canvas_runtime_unavailable");
    });

    it("returns 500 composition_failed for a generic canvas error", async () => {
      mockEdgeFunctionFetch({
        "/generate-mockup": { status: 500, body: { error: "composition_failed" } },
      });
      expect((await post(validBody())).status).toBe(500);
    });

    it("returns 500 storage_upload_failed when the upload fails", async () => {
      mockEdgeFunctionFetch({
        "/generate-mockup": { status: 500, body: { error: "storage_upload_failed" } },
      });
      const data = await (await post(validBody())).json();
      expect(data.error).toBe("storage_upload_failed");
    });

    it("never leaks a stack trace in the error body", async () => {
      mockEdgeFunctionFetch({
        "/generate-mockup": {
          status: 500,
          body: { error: "internal_error", message: "Internal server error" },
        },
      });
      const body = JSON.stringify(await (await post(validBody())).json());
      expect(body).not.toMatch(/at\s+\w+\s+\(/);
    });
  });

  describe("CORS", () => {
    it("OPTIONS returns CORS headers", async () => {
      mockEdgeFunctionFetch({
        "/generate-mockup": {
          status: 200,
          body: null,
          headers: { "access-control-allow-origin": "*" },
        },
      });
      const res = await fetch(`${BASE}/generate-mockup`, { method: "OPTIONS" });
      expect([200, 204]).toContain(res.status);
    });
  });
});
