import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "http://localhost:54321";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function invoke(name: string, method = "POST", body: any = {}, headers: any = {}) {
  const url = `${SUPABASE_URL}/functions/v1/${name}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      ...headers,
    },
    body: method === "GET" ? undefined : JSON.stringify(body),
  });
  return res;
}

Deno.test("PRODUCTION READINESS: health-check should be healthy", async () => {
  const res = await invoke("health-check", "GET");
  assertEquals(res.status, 200);
  const data = await res.json();
  assertEquals(data.status, "healthy");
  assert(data.checks.database.status === "healthy", "Main DB should be healthy");
  // External DB might be skipped if credentials aren't in this env, but shouldn't be 'unhealthy'
  assert(data.checks.external_db.status !== "unhealthy", "External DB should not be unhealthy");
});

Deno.test("PRODUCTION READINESS: CORS headers should be present", async () => {
  const res = await invoke("health-check", "OPTIONS");
  assertEquals(res.status, 200 || 204);
  assert(res.headers.get("access-control-allow-origin"), "Missing CORS origin");
  assert(res.headers.get("access-control-allow-methods"), "Missing CORS methods");
  // Consume any body if present
  await res.text();
});

Deno.test("PRODUCTION READINESS: Authentication bypass with service_role", async () => {
  // cnpj-lookup uses the shared authenticateRequest which we updated to allow service_role
  const res = await invoke("cnpj-lookup", "POST", { cnpj: "00000000000191" });
  // If it returned 401, the bypass failed. If 200, it succeeded.
  // 400 would mean auth passed but validation failed (which shouldn't happen for this mock CNPJ)
  assertEquals(res.status, 200, "Service role bypass failed for cnpj-lookup");
  const data = await res.json();
  assertEquals(data.success, true);
  assertEquals(data.data.razao_social, "TEST COMPANY LTDA");
});

Deno.test("PRODUCTION READINESS: Authentication rejection with invalid token", async () => {
  const res = await invoke("cnpj-lookup", "POST", { cnpj: "00000000000191" }, {
    "Authorization": "Bearer invalid-token"
  });
  assertEquals(res.status, 401);
  const data = await res.json();
  assert(data.error.includes("Token") || data.error.includes("autenticação"));
});

Deno.test("PRODUCTION READINESS: validate-access security check", async () => {
  const res = await invoke("validate-access", "POST", { ip: "127.0.0.1" });
  assertEquals(res.status, 200);
  const data = await res.json();
  assert(typeof data.allowed === "boolean");
});

Deno.test("PRODUCTION READINESS: webhook-inbound HMAC validation", async () => {
  // Should reject without signature
  const res = await invoke("webhook-inbound", "POST", { test: true });
  assertEquals(res.status, 401);
  const data = await res.json();
  assert(data.error.includes("assinatura") || data.error.includes("HMAC"));
});
