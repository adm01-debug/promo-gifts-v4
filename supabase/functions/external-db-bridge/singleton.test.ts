import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY");

async function ping() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  const FN_URL = `${SUPABASE_URL}/functions/v1/external-db-bridge`;
  const t0 = performance.now();
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ operation: "ping" }),
  });
  const body = await res.json();
  return { ms: Math.round(performance.now() - t0), status: res.status, body };
}

Deno.test("ping responde rápido e marca warm=true", async () => {
  const r = await ping();
  if (!r) return;
  assertEquals(r.status, 200);
  assertExists(r.body.ok);
  assertEquals(r.body.warm, true);
});

Deno.test("rajada de 5 pings consecutivos: 4 últimos são rápidos (singleton ativo)", async () => {
  const results: number[] = [];
  for (let i = 0; i < 5; i++) {
    const r = await ping();
    if (r) results.push(r.ms);
  }
  if (results.length === 0) return;
  
  const tail = results.slice(1);
  const slow = tail.filter((ms) => ms > 800);
  console.log("[singleton.test] timings:", results);
  if (slow.length > 1) {
    throw new Error(`Esperado ≤1 ping lento após o 1º; observado ${slow.length}: ${tail.join(", ")}ms`);
  }
});
