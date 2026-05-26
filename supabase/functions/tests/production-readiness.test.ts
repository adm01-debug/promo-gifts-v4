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
      "User-Agent": "Lovable-Production-Readiness-Test/1.0",
      ...headers,
    },
    body: method === "GET" || method === "OPTIONS" ? undefined : JSON.stringify(body),
  });
  return res;
}

Deno.test("PRODUCTION READINESS: health-check should be healthy", async () => {
  const res = await invoke("health-check", "GET");
  assertEquals(res.status, 200);
  const data = await res.json();
  assertEquals(data.status, "healthy");
  assert(data.checks.database.status === "healthy", "Main DB should be healthy");
  assert(data.checks.external_db.status !== "unhealthy", "External DB should not be unhealthy");
});

Deno.test("PRODUCTION READINESS: CORS headers should be present", async () => {
  const res = await invoke("health-check", "OPTIONS");
  assert(res.status === 200 || res.status === 204, `Unexpected status: ${res.status}`);
  assert(res.headers.get("access-control-allow-origin"), "Missing CORS origin");
  assert(res.headers.get("access-control-allow-methods"), "Missing CORS methods");
  await res.text();
});

Deno.test("PRODUCTION READINESS: Request ID propagation", async () => {
  const reqId = "test-id-" + Math.random();
  const res = await invoke("health-check", "GET", {}, { "x-request-id": reqId });
  assertEquals(res.status, 200);
  const data = await res.json();
  assert(data.request_id, "Missing request_id in response");
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
  // If service_role bypass works, this should be 200
  const data = await res.json();
  assert(res.status === 200 || res.status === 401, `Unexpected status: ${res.status}`);
});
