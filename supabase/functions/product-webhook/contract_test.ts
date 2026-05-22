/**
 * Testes Deno do contrato `product-webhook`. Exercita o helper compartilhado
 * `parseRequestWithContract` com o registry v1/v2 e valida shape de erro 422
 * + headers de versionamento (X-Contract-Version + Deprecation/Sunset para v1).
 *
 * Roda com:
 *   deno test --no-check --allow-env --allow-net=none \
 *     supabase/functions/product-webhook/contract_test.ts
 *
 * Estes testes NÃO sobem a função inteira (que requer SUPABASE_URL + secrets);
 * focam na camada de validação de contrato.
 */
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseRequestWithContract } from "../_shared/zod-validate.ts";
import { contracts } from "../_shared/contracts/product-webhook.contracts.ts";

const cors = { "Access-Control-Allow-Origin": "*" };

function makeReq(opts: {
  body?: unknown;
  headers?: Record<string, string>;
  bodyString?: string;
}): Request {
  return new Request("https://example.com/product-webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
    body:
      opts.bodyString !== undefined
        ? opts.bodyString
        : JSON.stringify(opts.body ?? {}),
  });
}

Deno.test("product-webhook: payload v1 válido sem header → resolve v1 + headers deprecation", async () => {
  const req = makeReq({
    body: { action: "upsert", product: { sku: "x", name: "y", price: 10 } },
  });
  const result = await parseRequestWithContract(req, contracts, cors);
  if ("error" in result) {
    throw new Error("Esperava sucesso, recebeu erro: " + (await result.error.text()));
  }
  assertEquals(result.version, "v1");
  assertEquals(result.responseHeaders["X-Contract-Version"], "v1");
  assertEquals(result.responseHeaders["Deprecation"], "true");
  assertEquals(result.responseHeaders["Sunset"], "2026-08-22");
});

Deno.test("product-webhook: payload v2 com header v2 → resolve v2 sem deprecation", async () => {
  const req = makeReq({
    headers: { "X-Contract-Version": "v2" },
    body: {
      action: "upsert",
      product: { sku: "x", name: "y", price: { amount: 10, currency: "BRL" } },
    },
  });
  const result = await parseRequestWithContract(req, contracts, cors);
  if ("error" in result) {
    throw new Error("Esperava sucesso, recebeu erro: " + (await result.error.text()));
  }
  assertEquals(result.version, "v2");
  assertEquals(result.responseHeaders["X-Contract-Version"], "v2");
  assertEquals(result.responseHeaders["Deprecation"], undefined);
});

Deno.test("product-webhook: payload v1 enviado com header v2 → 422 com path product.price", async () => {
  const req = makeReq({
    headers: { "X-Contract-Version": "v2" },
    body: { action: "upsert", product: { sku: "x", name: "y", price: 10 } },
  });
  const result = await parseRequestWithContract(req, contracts, cors);
  assert("error" in result, "esperava erro");
  if (!("error" in result)) return;
  assertEquals(result.error.status, 422);
  const body = (await result.error.json()) as {
    code: string;
    fields: Array<{ path: string }>;
  };
  assertEquals(body.code, "VALIDATION_FAILED");
  assert(
    body.fields.some((f) => f.path === "product.price"),
    "esperava field product.price; recebeu " + JSON.stringify(body.fields),
  );
});

Deno.test("product-webhook: header X-Contract-Version: v9 → 400 UNSUPPORTED_VERSION", async () => {
  const req = makeReq({
    headers: { "X-Contract-Version": "v9" },
    body: { action: "upsert", product: { sku: "x", name: "y", price: 10 } },
  });
  const result = await parseRequestWithContract(req, contracts, cors);
  assert("error" in result);
  if (!("error" in result)) return;
  assertEquals(result.error.status, 400);
  const body = (await result.error.json()) as { code: string };
  assertEquals(body.code, "UNSUPPORTED_VERSION");
});

Deno.test("product-webhook: body vazio → 400 MISSING_BODY", async () => {
  const req = makeReq({ bodyString: "" });
  const result = await parseRequestWithContract(req, contracts, cors);
  assert("error" in result);
  if (!("error" in result)) return;
  assertEquals(result.error.status, 400);
  const body = (await result.error.json()) as { code: string };
  assertEquals(body.code, "MISSING_BODY");
});

Deno.test("product-webhook: body JSON malformado → 400 INVALID_JSON", async () => {
  const req = makeReq({ bodyString: "{not valid json" });
  const result = await parseRequestWithContract(req, contracts, cors);
  assert("error" in result);
  if (!("error" in result)) return;
  assertEquals(result.error.status, 400);
  const body = (await result.error.json()) as { code: string };
  assertEquals(body.code, "INVALID_JSON");
});

Deno.test("product-webhook: action fora do enum → 422 com path action", async () => {
  const req = makeReq({
    body: { action: "drop", product: { sku: "x", name: "y", price: 10 } },
  });
  const result = await parseRequestWithContract(req, contracts, cors);
  assert("error" in result);
  if (!("error" in result)) return;
  assertEquals(result.error.status, 422);
  const body = (await result.error.json()) as { fields: Array<{ path: string }> };
  assert(body.fields.some((f) => f.path === "action"));
});

Deno.test("product-webhook: CORS headers preservados em respostas de erro", async () => {
  const req = makeReq({ body: {} });
  const customCors = {
    "Access-Control-Allow-Origin": "https://promogifts.com.br",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  const result = await parseRequestWithContract(req, contracts, customCors);
  assert("error" in result);
  if (!("error" in result)) return;
  assertEquals(
    result.error.headers.get("Access-Control-Allow-Origin"),
    "https://promogifts.com.br",
  );
});
