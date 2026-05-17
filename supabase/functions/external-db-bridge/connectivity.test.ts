import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";

// Load env with allowEmptyValues to avoid MissingEnvVarsError from .env.example
await load({ export: true, allowEmptyValues: true });

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const BRIDGE_URL = `${SUPABASE_URL}/functions/v1/external-db-bridge`;
const VISITOR_URL = `${SUPABASE_URL}/functions/v1/get-visitor-info`;

Deno.test("external-db-bridge: responds 200 with anon key (ping)", async () => {
  const res = await fetch(BRIDGE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ operation: "ping" }),
  });
  
  assertEquals(res.status, 200, `Bridge should respond 200, got ${res.status}`);
  const body = await res.json();
  assertEquals(body.ok, true);
  assertExists(body.config);
});

Deno.test("get-visitor-info: responds 200 with anon key", async () => {
  const res = await fetch(VISITOR_URL, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
    },
  });
  
  assertEquals(res.status, 200, `Visitor info should respond 200, got ${res.status}`);
  const body = await res.json();
  assertExists(body.ip);
});
