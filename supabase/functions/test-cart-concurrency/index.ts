import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { getCorsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // 1. Create a dummy seller and cart
  const seller_id = "00000000-0000-0000-0000-000000000001";

  const { data: cart, error: cartErr } = await supabase
    .from('seller_carts')
    .insert({
      seller_id,
      company_id: 'test-company',
      company_name: 'Test Company'
    })
    .select()
    .single();

  if (cartErr) return new Response(JSON.stringify(cartErr), { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });

  // 2. Simulate 10 simultaneous additions of the same item
  const item = {
    cart_id: cart.id,
    product_id: 'prod-123',
    product_name: 'Test Product',
    product_price: 10,
    quantity: 1,
    color_name: 'Red'
  };

  const results = await Promise.all(
    Array(10).fill(null).map(() =>
      supabase.from('seller_cart_items').insert(item)
    )
  );

  // 3. Check how many items were created
  const { data: finalItems } = await supabase
    .from('seller_cart_items')
    .select('*')
    .eq('cart_id', cart.id);

  // Cleanup
  await supabase.from('seller_carts').delete().eq('id', cart.id);

  return new Response(JSON.stringify({
    attempts: 10,
    successful_inserts: results.filter(r => !r.error).length,
    failed_inserts: results.filter(r => r.error).length,
    final_count: finalItems?.length,
    duplicate_bug_prevented: finalItems?.length === 1
  }), { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
});
