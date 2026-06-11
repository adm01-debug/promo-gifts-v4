import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const seller_id = "00000000-0000-0000-0000-000000000002";

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
  }), { headers: { "Content-Type": "application/json" } });
});
