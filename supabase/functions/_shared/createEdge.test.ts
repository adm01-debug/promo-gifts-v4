import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createEdge } from "./createEdge.ts";

Deno.test("createEdge cron auth: secret válido => 200 e handler executa", async () => {
  Deno.env.set("TEST_CREATE_EDGE_CRON_SECRET_OK", "valid-secret");
  let called = false;

  const edge = createEdge(
    { auth: "cron", secretEnv: "TEST_CREATE_EDGE_CRON_SECRET_OK" },
    async (_req, _ctx) => {
      called = true;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    },
  );

  const req = new Request("https://example.com/cron", {
    method: "POST",
    headers: { "x-cron-secret": "valid-secret" },
  });

  const res = await edge(req);
  assertEquals(res.status, 200);
  assertEquals(called, true);

  Deno.env.delete("TEST_CREATE_EDGE_CRON_SECRET_OK");
});

Deno.test("createEdge cron auth: secret ausente => 503 e handler NÃO executa", async () => {
  Deno.env.delete("TEST_CREATE_EDGE_CRON_SECRET_MISSING");
  let called = false;

  const edge = createEdge(
    { auth: "cron", secretEnv: "TEST_CREATE_EDGE_CRON_SECRET_MISSING" },
    async (_req, _ctx) => {
      called = true;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    },
  );

  const req = new Request("https://example.com/cron", {
    method: "POST",
    headers: { "x-cron-secret": "any" },
  });

  const res = await edge(req);
  assertEquals(res.status, 503);
  assertEquals(called, false);
});

Deno.test("createEdge cron auth: secret inválido => 401 e handler NÃO executa", async () => {
  Deno.env.set("TEST_CREATE_EDGE_CRON_SECRET_INVALID", "expected-secret");
  let called = false;

  const edge = createEdge(
    { auth: "cron", secretEnv: "TEST_CREATE_EDGE_CRON_SECRET_INVALID" },
    async (_req, _ctx) => {
      called = true;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    },
  );

  const req = new Request("https://example.com/cron", {
    method: "POST",
    headers: { "x-cron-secret": "wrong-secret" },
  });

  const res = await edge(req);
  assertEquals(res.status, 401);
  assertEquals(called, false);

  Deno.env.delete("TEST_CREATE_EDGE_CRON_SECRET_INVALID");
});
