import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { getCorsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const seller_id = "7b565451-7eb6-4063-a74b-8ce4dca8703d";

  // 1. Try to create 4 carts
  const results = [];
  for (let i = 0; i < 4; i++) {
    const res = await supabase.from('seller_carts').insert({
      seller_id,
      company_id: `comp-${i}`,
      company_name: `Company ${i}`
    });
    results.push(res);
  }

  // 2. Count carts
  const { data: finalCarts } = await supabase
    .from('seller_carts')
    .select('id')
    .eq('seller_id', seller_id);

  // Cleanup
  await supabase.from('seller_carts').delete().eq('seller_id', seller_id);

  return new Response(JSON.stringify({
    attempts: 4,
    successful_inserts: results.filter(r => !r.error).length,
    failed_inserts: results.filter(r => r.error).length,
    errors: results.map(r => r.error?.message).filter(Boolean),
    final_count: finalCarts?.length,
    limit_enforced: finalCarts?.length === 3
  }), { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
});
