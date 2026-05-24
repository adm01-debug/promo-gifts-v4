// supabase/functions/_shared/dispatcher-auth.test.ts
// Testes unitários para autorização de webhook-dispatcher e connections-auto-test.

import { assertEquals, assertStrictEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { authorizeCron, constantTimeEqual } from "./dispatcher-auth.ts";

// CORS headers mock simples (não usados nas asserts)
const CORS = { "access-control-allow-origin": "*" };

// ───────────────────────────────────────────────────────────────────────
// constantTimeEqual
// ───────────────────────────────────────────────────────────────────────

Deno.test("constantTimeEqual: strings iguais => true", () => {
  assertStrictEquals(constantTimeEqual("abc123", "abc123"), true);
});

Deno.test("constantTimeEqual: strings diferentes => false", () => {
  assertStrictEquals(constantTimeEqual("abc123", "abc124"), false);
});

Deno.test("constantTimeEqual: tamanhos diferentes => false (cedo)", () => {
  assertStrictEquals(constantTimeEqual("abc", "abcd"), false);
});

Deno.test("constantTimeEqual: string vazia vs string vazia => true", () => {
  assertStrictEquals(constantTimeEqual("", ""), true);
});

Deno.test("constantTimeEqual: input nao-string => false", () => {
  // @ts-expect-error - testa runtime guard
  assertStrictEquals(constantTimeEqual(null, "abc"), false);
  // @ts-expect-error
  assertStrictEquals(constantTimeEqual("abc", undefined), false);
});

Deno.test("constantTimeEqual: secrets longos do mundo real", () => {
  const a = "4aszZ/Nh0cInRX0RVTkt+YGqA8BObghWsoAjEOGB7g8=";
  const b = "4aszZ/Nh0cInRX0RVTkt+YGqA8BObghWsoAjEOGB7g8=";
  const c = "4aszZ/Nh0cInRX0RVTkt+YGqA8BObghWsoAjEOGB7g9=";
  assertStrictEquals(constantTimeEqual(a, b), true);
  assertStrictEquals(constantTimeEqual(a, c), false);
});

// ───────────────────────────────────────────────────────────────────────
// authorizeCron — Modo C
// ───────────────────────────────────────────────────────────────────────

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("https://example.com/", { method: "POST", headers });
}

Deno.test("authorizeCron: env nao setada => fail-closed 503 (SEC-003)", async () => {
  Deno.env.delete("TEST_CRON_SECRET_1");
  const req = makeRequest({});
  const result = await authorizeCron(req, {
    corsHeaders: CORS,
    secretEnvName: "TEST_CRON_SECRET_1",
    headerName: "x-cron-secret",
  });
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.response.status, 503);
    const body = await result.response.json();
    assertEquals(body.error, "service_misconfigured");
  }
});

Deno.test("authorizeCron: env setada + sem header => 401", async () => {
  Deno.env.set("TEST_CRON_SECRET_2", "supersecret123");
  const req = makeRequest({});
  const result = await authorizeCron(req, {
    corsHeaders: CORS,
    secretEnvName: "TEST_CRON_SECRET_2",
    headerName: "x-cron-secret",
  });
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.response.status, 401);
  }
  Deno.env.delete("TEST_CRON_SECRET_2");
});

Deno.test("authorizeCron: env setada + header correto => ok (modo secret)", async () => {
  Deno.env.set("TEST_CRON_SECRET_3", "supersecret123");
  const req = makeRequest({ "x-cron-secret": "supersecret123" });
  const result = await authorizeCron(req, {
    corsHeaders: CORS,
    secretEnvName: "TEST_CRON_SECRET_3",
    headerName: "x-cron-secret",
  });
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.mode, "secret");
  }
  Deno.env.delete("TEST_CRON_SECRET_3");
});

Deno.test("authorizeCron: env setada + header errado => 401", async () => {
  Deno.env.set("TEST_CRON_SECRET_4", "supersecret123");
  const req = makeRequest({ "x-cron-secret": "wrong_secret" });
  const result = await authorizeCron(req, {
    corsHeaders: CORS,
    secretEnvName: "TEST_CRON_SECRET_4",
    headerName: "x-cron-secret",
  });
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.response.status, 401);
  }
  Deno.env.delete("TEST_CRON_SECRET_4");
});

Deno.test("authorizeCron: header de tamanho diferente nao causa timing leak", async () => {
  // Não é teste de timing real (impreciso em CI), mas valida que NÃO retorna
  // sucesso só porque o tamanho difere (a função aborta cedo com return false).
  Deno.env.set("TEST_CRON_SECRET_5", "supersecret123");
  const req = makeRequest({ "x-cron-secret": "x" });
  const result = await authorizeCron(req, {
    corsHeaders: CORS,
    secretEnvName: "TEST_CRON_SECRET_5",
    headerName: "x-cron-secret",
  });
  assertEquals(result.ok, false);
  Deno.env.delete("TEST_CRON_SECRET_5");
});

Deno.test("authorizeCron: secret com chars especiais (base64)", async () => {
  const realSecret = "j/nKCXCqyvYgucMAX1wuHJO6QhEDPVaWLWoIsqlfp+o=";
  Deno.env.set("TEST_CRON_SECRET_6", realSecret);
  const req = makeRequest({ "x-cron-secret": realSecret });
  const result = await authorizeCron(req, {
    corsHeaders: CORS,
    secretEnvName: "TEST_CRON_SECRET_6",
    headerName: "x-cron-secret",
  });
  assertEquals(result.ok, true);
  Deno.env.delete("TEST_CRON_SECRET_6");
});


Deno.test("authorizeCron: bearer com SERVICE_ROLE_KEY nao autentica cron (401)", async () => {
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "svc-role-secret");
  Deno.env.set("TEST_CRON_SECRET_7", "real-cron-secret");

  const req = makeRequest({ Authorization: "Bearer svc-role-secret" });
  const result = await authorizeCron(req, {
    corsHeaders: CORS,
    secretEnvName: "TEST_CRON_SECRET_7",
    headerName: "x-cron-secret",
  });

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.response.status, 401);
  }

  Deno.env.delete("TEST_CRON_SECRET_7");
  Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
});

// NOTE: testes do authorizeDispatcher dependem de mock de Supabase Auth para
// validar JWT — escopo de integration test, não unit. O fluxo Modo A (secret)
// é simétrico ao authorizeCron e está coberto pelos testes acima.
