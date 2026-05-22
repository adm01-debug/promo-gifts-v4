/**
 * Testes Deno do contrato `webhook-dispatcher`. Foca no helper
 * `parseBodyWithSchema` com o schema canônico (single version v1).
 *
 * Roda com:
 *   deno test --no-check --allow-env --allow-net=none \
 *     supabase/functions/webhook-dispatcher/contract_test.ts
 */
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseBodyWithSchema } from "../_shared/zod-validate.ts";
import { contracts } from "../_shared/contracts/webhook-dispatcher.contracts.ts";

const cors = { "Access-Control-Allow-Origin": "*" };

function makeReq(opts: { body?: unknown; bodyString?: string }): Request {
  return new Request("https://example.com/webhook-dispatcher", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body:
      opts.bodyString !== undefined
        ? opts.bodyString
        : JSON.stringify(opts.body ?? {}),
  });
}

Deno.test("webhook-dispatcher: payload válido com event apenas", async () => {
  const req = makeReq({ body: { event: "order.created" } });
  const r = await parseBodyWithSchema(req, contracts.v1.schema, cors);
  if ("error" in r) throw new Error("esperava sucesso, " + (await r.error.text()));
  assertEquals(r.data.event, "order.created");
});

Deno.test("webhook-dispatcher: event vazio → 422 com path 'event'", async () => {
  const req = makeReq({ body: { event: "" } });
  const r = await parseBodyWithSchema(req, contracts.v1.schema, cors);
  assert("error" in r);
  if (!("error" in r)) return;
  assertEquals(r.error.status, 422);
  const body = (await r.error.json()) as { fields: Array<{ path: string }> };
  assert(body.fields.some((f) => f.path === "event"));
});

Deno.test("webhook-dispatcher: event ausente → 422 path 'event' code 'required'", async () => {
  const req = makeReq({ body: {} });
  const r = await parseBodyWithSchema(req, contracts.v1.schema, cors);
  assert("error" in r);
  if (!("error" in r)) return;
  const body = (await r.error.json()) as {
    fields: Array<{ path: string; code: string }>;
  };
  const eventField = body.fields.find((f) => f.path === "event");
  assert(eventField, "esperava field 'event' em " + JSON.stringify(body.fields));
  assertEquals(eventField!.code, "required");
});

Deno.test("webhook-dispatcher: test_webhook_id não-UUID → 422 path correto", async () => {
  const req = makeReq({
    body: { event: "x", test_mode: true, test_webhook_id: "not-uuid" },
  });
  const r = await parseBodyWithSchema(req, contracts.v1.schema, cors);
  assert("error" in r);
  if (!("error" in r)) return;
  const body = (await r.error.json()) as { fields: Array<{ path: string }> };
  assert(body.fields.some((f) => f.path === "test_webhook_id"));
});

Deno.test("webhook-dispatcher: body vazio (string) → 400 MISSING_BODY", async () => {
  const req = makeReq({ bodyString: "" });
  const r = await parseBodyWithSchema(req, contracts.v1.schema, cors);
  assert("error" in r);
  if (!("error" in r)) return;
  assertEquals(r.error.status, 400);
  const body = (await r.error.json()) as { code: string };
  assertEquals(body.code, "MISSING_BODY");
});

Deno.test("webhook-dispatcher: JSON malformado → 400 INVALID_JSON", async () => {
  const req = makeReq({ bodyString: "{not json" });
  const r = await parseBodyWithSchema(req, contracts.v1.schema, cors);
  assert("error" in r);
  if (!("error" in r)) return;
  assertEquals(r.error.status, 400);
  const body = (await r.error.json()) as { code: string };
  assertEquals(body.code, "INVALID_JSON");
});

Deno.test("webhook-dispatcher: examples.valid são aceitos", async () => {
  for (const payload of contracts.v1.examples?.valid ?? []) {
    const req = makeReq({ body: payload });
    const r = await parseBodyWithSchema(req, contracts.v1.schema, cors);
    assert(!("error" in r), `valid payload rejeitado: ${JSON.stringify(payload)}`);
  }
});

Deno.test("webhook-dispatcher: examples.invalid são rejeitados (422 ou 400)", async () => {
  for (const { payload, expectedPath } of contracts.v1.examples?.invalid ?? []) {
    const req = makeReq({ body: payload });
    const r = await parseBodyWithSchema(req, contracts.v1.schema, cors);
    assert("error" in r, `invalid payload aceito: ${JSON.stringify(payload)}`);
    if (!("error" in r) || !expectedPath) continue;
    const body = (await r.error.json()) as { fields: Array<{ path: string }> };
    assert(
      body.fields.some((f) => f.path === expectedPath),
      `expectedPath="${expectedPath}" não em ${JSON.stringify(body.fields)}`,
    );
  }
});
