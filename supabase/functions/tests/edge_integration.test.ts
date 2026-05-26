import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

/**
 * Testes de integração para Edge Functions.
 *
 * Objetivo desta suíte:
 * - Cobrir matriz de status esperados por endpoint
 * - Garantir consistência mínima para cenários canônicos:
 *   sucesso, validação, auth, não encontrado, conflito e erro interno
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "http://localhost:54321";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

type EndpointName = "ai-recommendations" | "bitrix-sync" | "expert-chat" | "quote-approval";
type ScenarioKey = "success" | "validation" | "auth" | "notFound" | "conflict" | "internalError";

const EDGE_STATUS_MATRIX: Record<EndpointName, Record<ScenarioKey, number[]>> = {
  "ai-recommendations": {
    success: [200],
    validation: [400, 422],
    auth: [401, 403],
    notFound: [404],
    conflict: [409],
    internalError: [500],
  },
  "bitrix-sync": {
    success: [200, 202],
    validation: [400, 422],
    auth: [401, 403],
    notFound: [404],
    conflict: [409],
    internalError: [500],
  },
  "expert-chat": {
    success: [200],
    validation: [400, 422],
    auth: [401, 403],
    notFound: [404],
    conflict: [409],
    internalError: [500],
  },
  "quote-approval": {
    success: [200],
    validation: [400, 422],
    auth: [401, 403],
    notFound: [404],
    conflict: [409],
    internalError: [500],
  },
};

function expectStatusInScenario(endpoint: EndpointName, scenario: ScenarioKey, actualStatus: number) {
  const expected = EDGE_STATUS_MATRIX[endpoint][scenario];
  assert(
    expected.includes(actualStatus),
    `[${endpoint}] cenário '${scenario}' esperava um de ${expected.join(", ")}, recebeu ${actualStatus}`,
  );
}

async function invokeFunction(name: string, body: unknown, headers: Record<string, string> = {}) {
  const url = `${SUPABASE_URL}/functions/v1/${name}`;
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

async function invokeWithoutAuth(name: string, body: unknown, headers: Record<string, string> = {}) {
  const url = `${SUPABASE_URL}/functions/v1/${name}`;
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

Deno.test("Edge Function: cnpj-lookup - validação de entrada", async () => {
  const res = await invokeFunction("cnpj-lookup", { cnpj: "invalid" });
  assertEquals(res.status, 400, "CNPJ inválido deve retornar 400");
  const data = await res.json();
  assert(data.error || data.message, "Deve conter mensagem de erro");
});

Deno.test("Edge Function: validate-access - status codes", async () => {
  const res = await invokeFunction("validate-access", {});
  assert(res.status === 400 || res.status === 401, `Status inesperado: ${res.status}`);
});

Deno.test("Edge Function: webhook-inbound - HMAC verification", async () => {
  const res1 = await invokeFunction("webhook-inbound", { event: "test" });
  assertEquals(res1.status, 401, "Rejeitar sem assinatura");

  const res2 = await invokeFunction("webhook-inbound", { event: "test" }, {
    "X-Hub-Signature-256": "plain_text_not_hmac",
  });
  assertEquals(res2.status, 401, "Rejeitar formato inválido");

  const res3 = await invokeFunction("webhook-inbound", { event: "test" }, {
    "X-Hub-Signature-256": "sha256=4f2f5e1f76e3d23f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f",
  });
  assertEquals(res3.status, 401, "Rejeitar assinatura incorreta");
});

Deno.test("Edge Matrix: auth sem token nas 4 funções principais", async () => {
  const endpoints: EndpointName[] = ["ai-recommendations", "bitrix-sync", "expert-chat", "quote-approval"];

  for (const endpoint of endpoints) {
    const res = await invokeWithoutAuth(endpoint, {});
    expectStatusInScenario(endpoint, "auth", res.status);
    await res.body?.cancel();
  }
});

Deno.test("Edge Matrix: validação com payload vazio/não conforme", async () => {
  const cases: Array<{ endpoint: EndpointName; body: Record<string, unknown> }> = [
    { endpoint: "ai-recommendations", body: { limit: -1 } },
    { endpoint: "bitrix-sync", body: { malformed: true } },
    { endpoint: "expert-chat", body: {} },
    { endpoint: "quote-approval", body: { token: "", action: "invalid" } },
  ];

  for (const { endpoint, body } of cases) {
    const res = await invokeFunction(endpoint, body);
    expectStatusInScenario(endpoint, "validation", res.status);
    await res.body?.cancel();
  }
});

Deno.test("Edge Matrix: conflito/idempotência em bitrix-sync não pode virar 5xx", async () => {
  const payload = { quote_id: "test-dedup-id", event: "quote.created", data: {} };
  const res1 = await invokeFunction("bitrix-sync", payload);
  const res2 = await invokeFunction("bitrix-sync", payload);

  assert(
    EDGE_STATUS_MATRIX["bitrix-sync"].conflict.includes(res2.status) || EDGE_STATUS_MATRIX["bitrix-sync"].success.includes(res2.status),
    `[bitrix-sync] segunda chamada deveria retornar sucesso ou conflito (${[...EDGE_STATUS_MATRIX["bitrix-sync"].success, ...EDGE_STATUS_MATRIX["bitrix-sync"].conflict].join(",")}); recebeu ${res2.status}`,
  );

  await res1.body?.cancel();
  await res2.body?.cancel();
});
