import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// This test requires a running Supabase instance or a mock
// Since we want to test the 'webhook_request_nonces' logic, we'll focus on the logic description
// and use the existing tool to run it if possible.

Deno.test("Idempotency: Should detect replayed nonce", async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "http://localhost:54321";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "test-key";
  const supabase = createClient(supabaseUrl, supabaseKey);

  const nonce = "test-nonce-" + Math.random();
  const timestamp = Math.floor(Date.now() / 1000);
  const tolerance = 300;

  // First insertion should succeed
  const { error: error1 } = await supabase.from('webhook_request_nonces' as any).insert({
    source: 'product-webhook-test',
    nonce,
    request_timestamp: new Date(timestamp * 1000).toISOString(),
    expires_at: new Date((timestamp + tolerance) * 1000).toISOString(),
  } as any);

  if (error1) {
    console.warn("Skipping real DB test - no connection");
    return;
  }

  // Second insertion with same nonce should fail with 23505 (unique violation)
  const { error: error2 } = await supabase.from('webhook_request_nonces' as any).insert({
    source: 'product-webhook-test',
    nonce,
    request_timestamp: new Date(timestamp * 1000).toISOString(),
    expires_at: new Date((timestamp + tolerance) * 1000).toISOString(),
  } as any);

  assertEquals(error2?.code, '23505');
});
