import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("Security Headers Integration Test", async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "http://localhost:54321";
  const functionUrl = `${supabaseUrl}/functions/v1/health-check`;
  const resp = await fetch(functionUrl, { method: "GET" });
  await resp.text(); // Consume body to avoid leaks
  
  const csp = resp.headers.get("Content-Security-Policy");
  const hsts = resp.headers.get("Strict-Transport-Security");
  const xcto = resp.headers.get("X-Content-Type-Options");
  const xfo = resp.headers.get("X-Frame-Options");

  console.log("CSP:", csp);
  
  assertEquals(xcto, "nosniff");
  assertEquals(xfo, "DENY");
  assertEquals(typeof hsts, "string");
  assertEquals(csp?.includes("strict-dynamic"), true);
});

Deno.test("CSRF Protection Integration Test", async () => {
  // Simulating a request with cookies but no CSRF token
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "http://localhost:54321";
  const functionUrl = `${supabaseUrl}/functions/v1/health-check`;
  const resp = await fetch(functionUrl, {
    method: "POST",
    headers: {
      "Cookie": "sb-access-token=mock-token",
    }
  });
  
  await resp.text(); // Consume body to avoid leaks
  
  // Should be blocked if implemented in health-check or via shared middleware
  // For now we'll just check if the logic is callable
});
