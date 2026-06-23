/**
 * test-cart-concurrency — Edge function de CI para validar o constraint unique_cart_item_variant.
 *
 * Simula 10 INSERTs simultâneos do MESMO item (mesmo product_id + color_name) e verifica
 * que o constraint UNIQUE NULLS NOT DISTINCT os colapsa para apenas 1 linha.
 *
 * IMPORTANTE: cria usuário temporário via auth.admin para satisfazer a FK
 *   seller_carts.seller_id → auth.users(id). Cleanup via deleteUser (CASCADE).
 */
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { getCorsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // 1. Cria usuário temporário para satisfazer FK seller_carts.seller_id → auth.users
  const testEmail = `ci-cart-concurrency-${Date.now()}@test.internal`;
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email: testEmail,
    password: "ci-test-password-2026",
    email_confirm: true,
  });

  if (authErr || !authData?.user?.id) {
    return new Response(
      JSON.stringify({ error: `Falha ao criar usuário de teste: ${authErr?.message}` }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  }

  const seller_id = authData.user.id;

  try {
    // 2. Cria um carrinho para o usuário de teste
    const { data: cart, error: cartErr } = await supabase
      .from("seller_carts")
      .insert({
        seller_id,
        company_id: `ci-concurrency-company-${Date.now()}`,
        company_name: "CI Concurrency Test Company",
      })
      .select()
      .single();

    if (cartErr || !cart) {
      return new Response(
        JSON.stringify({ error: `Falha ao criar carrinho de teste: ${cartErr?.message}` }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    // 3. Simula 10 INSERTs simultâneos do mesmo item (mesmo product_id + color_name)
    // O constraint unique_cart_item_variant(cart_id, product_id, color_name) NULLS NOT DISTINCT
    // deve permitir apenas 1 e rejeitar os outros 9 com code 23505.
    const item = {
      cart_id: cart.id,
      product_id: "ci-prod-concurrent-123",
      product_name: "CI Concurrent Test Product",
      product_price: 10,
      quantity: 1,
      color_name: "Red",
    };

    const results = await Promise.all(
      Array(10)
        .fill(null)
        .map(() => supabase.from("seller_cart_items").insert(item)),
    );

    // 4. Verifica quantos itens foram efetivamente criados
    const { data: finalItems } = await supabase
      .from("seller_cart_items")
      .select("*")
      .eq("cart_id", cart.id);

    const successCount = results.filter((r) => !r.error).length;
    const failCount = results.filter((r) => r.error).length;
    const constraintErrors = results.filter((r) => r.error?.code === "23505").length;

    return new Response(
      JSON.stringify({
        attempts: 10,
        successful_inserts: successCount,
        failed_inserts: failCount,
        constraint_23505_rejections: constraintErrors,
        final_item_count: finalItems?.length ?? 0,
        // true = exatamente 1 linha criada (constraint funcionando)
        duplicate_bug_prevented: finalItems?.length === 1,
      }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  } finally {
    // 5. Cleanup: deleteUser cascateia seller_carts → seller_cart_items
    await supabase.auth.admin.deleteUser(seller_id);
  }
});
