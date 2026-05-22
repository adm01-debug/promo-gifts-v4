/**
 * Testes Deno do contrato de envelope do `webhook-inbound`.
 *
 * Este endpoint aceita payloads opacos de terceiros — a validação foco é no
 * envelope (slug + assinatura HMAC + event header), não no body.
 *
 * Roda com:
 *   deno test --no-check --allow-env --allow-net=none \
 *     supabase/functions/webhook-inbound/contract_test.ts
 */
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { contracts } from "../_shared/contracts/webhook-inbound.contracts.ts";
import {
  validationErrorResponse,
  zodErrorToFields,
  ERROR_CODES,
} from "../_shared/contracts/error-response.ts";

const cors = { "Access-Control-Allow-Origin": "*" };

Deno.test("webhook-inbound envelope: aceita slug + body opaco", () => {
  const r = contracts.v1.schema.safeParse({
    slug: "asaas-payment",
    body: { foo: "bar", nested: { x: 1 } },
  });
  assert(r.success, "esperava success");
});

Deno.test("webhook-inbound envelope: slug ausente → rejeita com path 'slug'", () => {
  const r = contracts.v1.schema.safeParse({ body: {} });
  assert(!r.success);
  if (r.success) return;
  const paths = r.error.issues.map((i) => i.path.join("."));
  assert(paths.includes("slug"), "esperava path 'slug'; recebeu " + JSON.stringify(paths));
});

Deno.test("webhook-inbound envelope: slug vazio → rejeita (min 1)", () => {
  const r = contracts.v1.schema.safeParse({ slug: "", body: {} });
  assert(!r.success);
});

Deno.test("webhook-inbound envelope: signature inválida (muito curta) → 422 com path correto", async () => {
  const r = contracts.v1.schema.safeParse({
    slug: "x",
    signature: "ab",
    body: {},
  });
  assert(!r.success);
  if (r.success) return;
  const res = validationErrorResponse(r.error, cors);
  assertEquals(res.status, 422);
  const body = (await res.json()) as {
    code: string;
    fields: Array<{ path: string }>;
  };
  assertEquals(body.code, ERROR_CODES.VALIDATION_FAILED);
  assert(body.fields.some((f) => f.path === "signature"));
});

Deno.test("webhook-inbound: zodErrorToFields normaliza path para dot-notation", () => {
  const r = contracts.v1.schema.safeParse({ body: {} });
  if (r.success) throw new Error("expected fail");
  const fields = zodErrorToFields(r.error);
  for (const f of fields) {
    assert(!f.path.includes("["), `path com bracket: ${f.path}`);
  }
});

Deno.test("webhook-inbound envelope: examples.valid são aceitos", () => {
  for (const payload of contracts.v1.examples?.valid ?? []) {
    const r = contracts.v1.schema.safeParse(payload);
    assert(r.success, `payload válido rejeitado: ${JSON.stringify(payload)}`);
  }
});

Deno.test("webhook-inbound envelope: examples.invalid são rejeitados", () => {
  for (const { payload, expectedPath } of contracts.v1.examples?.invalid ?? []) {
    const r = contracts.v1.schema.safeParse(payload);
    assert(!r.success, `payload inválido aceito: ${JSON.stringify(payload)}`);
    if (r.success || !expectedPath) continue;
    const paths = r.error.issues.map((i) => i.path.join("."));
    assert(
      paths.includes(expectedPath),
      `expectedPath="${expectedPath}" não em ${JSON.stringify(paths)}`,
    );
  }
});
