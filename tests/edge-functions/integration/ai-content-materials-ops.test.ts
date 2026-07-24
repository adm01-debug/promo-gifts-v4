/**
 * Integration (contract) tests — AI content, materials and ops edge functions.
 *
 * The Deno edge functions cannot run in-process under vitest (Deno.serve, npm:
 * imports, external Supabase clients), so these tests mock the HTTP layer and
 * assert against each function's REAL request/response contract, exactly like
 * tests/edge-functions/integration/generate-mockup.test.ts.
 *
 * Contracts are derived from the function sources under supabase/functions/:
 *   - analyze-logo-colors:      success { colors: [...] } | 400 invalid/SVG | 429 quota
 *   - generate-product-seo:     success <result> | 400 validation | 402 credits | 429 quota
 *   - generate-ad-prompt:       success { prompts } | 400 validation | 402 credits
 *   - kit-identity-suggest:     success { suggestion } | 400 params | 502 bad AI response
 *   - materials-api:            success { data, success:true } | 200 _unconfigured | 400 action
 *   - connections-health-check: success { ok:true, incidents, admins, keys } | 200 skipped
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockEdgeFunctionFetch, resetExternalMocks } from "../../p0/_mocks";

const BASE = "https://doufsxqlfjyuvxuezpln.supabase.co/functions/v1";

async function post(path: string, body: unknown, withAuth = true) {
  return fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(withAuth ? { Authorization: "Bearer valid-jwt" } : {}),
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => mockEdgeFunctionFetch({}));
afterEach(() => resetExternalMocks());

describe("analyze-logo-colors", () => {
  it("returns 200 with a colors array on success", async () => {
    mockEdgeFunctionFetch({
      "/analyze-logo-colors": {
        status: 200,
        body: { colors: [{ hex: "#FF0000", name: "Vermelho" }] },
      },
    });
    const data = await (await post("/analyze-logo-colors", { imageUrl: "https://cdn.example.com/logo.png" })).json();
    expect(Array.isArray(data.colors)).toBe(true);
    expect(data.colors[0].hex).toMatch(/^#/);
  });

  it("rejects SVG logos with 400", async () => {
    mockEdgeFunctionFetch({
      "/analyze-logo-colors": {
        status: 400,
        body: { error: "Formato SVG não é suportado para análise de cores. Por favor, envie a logo em PNG, JPG ou WEBP." },
      },
    });
    const res = await post("/analyze-logo-colors", { imageBase64: "data:image/svg+xml;base64,PHN2Zz4=" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/SVG/i);
  });

  it("returns 401 without a token", async () => {
    mockEdgeFunctionFetch({ "/analyze-logo-colors": { status: 401, body: { error: "Token inválido ou expirado" } } });
    expect((await post("/analyze-logo-colors", {}, false)).status).toBe(401);
  });
});

describe("generate-product-seo", () => {
  it("returns 200 with the generated SEO result", async () => {
    mockEdgeFunctionFetch({
      "/generate-product-seo": {
        status: 200,
        body: { title: "Caneca", metaDescription: "desc", keywords: ["brinde"] },
      },
    });
    const res = await post("/generate-product-seo", { productName: "Caneca" });
    expect(res.status).toBe(200);
    expect((await res.json()).title).toBeTruthy();
  });

  it("returns 400 Validation failed with field details", async () => {
    mockEdgeFunctionFetch({
      "/generate-product-seo": {
        status: 400,
        body: { error: "Validation failed", details: { productName: ["Required"] } },
      },
    });
    const data = await (await post("/generate-product-seo", {})).json();
    expect(data.error).toBe("Validation failed");
    expect(data.details).toBeTruthy();
  });

  it("returns 402 when the account is out of AI credits", async () => {
    mockEdgeFunctionFetch({ "/generate-product-seo": { status: 402, body: { error: "Créditos insuficientes." } } });
    expect((await post("/generate-product-seo", { productName: "X" })).status).toBe(402);
  });
});

describe("generate-ad-prompt", () => {
  it("returns 200 with a prompts payload", async () => {
    mockEdgeFunctionFetch({ "/generate-ad-prompt": { status: 200, body: { prompts: ["um banner vibrante"] } } });
    const data = await (await post("/generate-ad-prompt", { productName: "Caneca" })).json();
    expect(Array.isArray(data.prompts)).toBe(true);
  });

  it("returns 402 when AI credits are exhausted", async () => {
    mockEdgeFunctionFetch({ "/generate-ad-prompt": { status: 402, body: { error: "Créditos de IA esgotados." } } });
    expect((await post("/generate-ad-prompt", { productName: "X" })).status).toBe(402);
  });
});

describe("kit-identity-suggest", () => {
  it("returns 200 with a suggestion", async () => {
    mockEdgeFunctionFetch({ "/kit-identity-suggest": { status: 200, body: { suggestion: { name: "Kit Bem-Vindo" } } } });
    const data = await (await post("/kit-identity-suggest", { name: "kit" })).json();
    expect(data.suggestion).toBeTruthy();
  });

  it("returns 400 when neither name nor items are provided", async () => {
    mockEdgeFunctionFetch({ "/kit-identity-suggest": { status: 400, body: { error: "Forneça name ou items" } } });
    const res = await post("/kit-identity-suggest", {});
    expect(res.status).toBe(400);
  });

  it("returns 502 when the AI response is invalid", async () => {
    mockEdgeFunctionFetch({ "/kit-identity-suggest": { status: 502, body: { error: "Resposta IA inválida" } } });
    expect((await post("/kit-identity-suggest", { name: "kit" })).status).toBe(502);
  });
});

describe("materials-api", () => {
  it("returns 200 { data, success:true } for a valid action", async () => {
    mockEdgeFunctionFetch({
      "/materials-api": { status: 200, body: { data: [{ id: "g1", name: "Metais" }], success: true } },
    });
    const data = await (await post("/materials-api", { action: "groups" })).json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
  });

  it("returns 200 with _unconfigured when the external DB is not configured", async () => {
    mockEdgeFunctionFetch({
      "/materials-api": {
        status: 200,
        body: { data: [], records: [], count: 0, _unconfigured: true, _message: "Banco externo não configurado" },
      },
    });
    const data = await (await post("/materials-api", { action: "groups" })).json();
    expect(data._unconfigured).toBe(true);
  });

  it("returns 400 listing availableActions for an unsupported action", async () => {
    mockEdgeFunctionFetch({
      "/materials-api": {
        status: 400,
        body: { error: "Ação 'bogus' não suportada", availableActions: ["groups", "types", "search"] },
      },
    });
    const data = await (await post("/materials-api", { action: "bogus" })).json();
    expect(data.error).toMatch(/não suportada/);
    expect(Array.isArray(data.availableActions)).toBe(true);
  });
});

describe("connections-health-check", () => {
  it("returns 200 with the incident summary shape", async () => {
    mockEdgeFunctionFetch({
      "/connections-health-check": {
        status: 200,
        body: { ok: true, incidents: 2, admins: 3, keys: ["bitrix", "n8n"] },
      },
    });
    const data = await (await post("/connections-health-check", {})).json();
    expect(data.ok).toBe(true);
    expect(typeof data.incidents).toBe("number");
    expect(Array.isArray(data.keys)).toBe(true);
  });

  it("returns 200 skipped:no_admins when there are no admins to notify", async () => {
    mockEdgeFunctionFetch({
      "/connections-health-check": { status: 200, body: { ok: true, skipped: "no_admins" } },
    });
    const data = await (await post("/connections-health-check", {})).json();
    expect(data.skipped).toBe("no_admins");
  });
});
